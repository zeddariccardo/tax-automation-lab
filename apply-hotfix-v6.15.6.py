#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

RELEASE = "v6.15.6"
TOOL_VERSION = "2.0.5"
OLD_TOOL_VERSION = "2.0.4"
MARKER = '<script id="tal-fa-v205-xlsx-hotfix">'
TARGETS = [
    Path("tools/financial-analysis/index.html"),
    Path("en/tools/financial-analysis/index.html"),
    Path("es/tools/financial-analysis/index.html"),
]
GENERATED_DOCS = [
    "ISTRUZIONI-DEPLOY-v6.15.6.md",
    "QA-v6.15.6.json",
    "RELEASE-NOTES-v6.15.6.md",
]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text_atomic(path: Path, content: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tal-tmp")
    tmp.write_text(content, encoding="utf-8", newline="\n")
    tmp.replace(path)


def backup_file(repo: Path, package: Path, rel: Path) -> None:
    source = repo / rel
    target = package / "_backup" / rel
    if target.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def patch_html(path: Path, hotfix_js: str) -> str:
    content = read_text(path)
    if MARKER in content:
        if content.count(MARKER) != 1:
            raise RuntimeError(f"Marker hotfix duplicato in {path}")
        return "already_patched"
    if "tal-fa-v204-result-reconciliation" not in content:
        raise RuntimeError(f"{path} non corrisponde alla Financial Analysis v2.0.4 attesa")
    if "writeWorkbookFile" not in content or "XLSX.write" not in content:
        raise RuntimeError(f"Funzioni XLSX attese non trovate in {path}")
    if not re.search(r"</body>\s*</html>\s*$", content, flags=re.I):
        raise RuntimeError(f"Chiusura HTML non trovata in {path}")

    content = re.sub(
        rf'data-tool-version="{re.escape(OLD_TOOL_VERSION)}"',
        f'data-tool-version="{TOOL_VERSION}"',
        content,
        count=1,
    )
    script_tag = f'{MARKER}\n{hotfix_js.rstrip()}\n</script>'
    content = re.sub(
        r"</body>\s*</html>\s*$",
        lambda _match: script_tag + "\n</body></html>\n",
        content,
        count=1,
        flags=re.I,
    )
    if content.count(MARKER) != 1:
        raise RuntimeError(f"Inserimento hotfix non univoco in {path}")
    write_text_atomic(path, content)
    return "patched"


def update_manifest(repo: Path, package: Path) -> None:
    rel = Path("tools/manifest.json")
    path = repo / rel
    if not path.exists():
        raise RuntimeError("tools/manifest.json non trovato")
    backup_file(repo, package, rel)
    data = json.loads(read_text(path))
    data["release"] = RELEASE
    data["date"] = "2026-07-28"
    found = False
    for tool in data.get("tools", []):
        if tool.get("slug") == "financial-analysis":
            tool["version"] = TOOL_VERSION
            found = True
    if not found:
        raise RuntimeError("Voce financial-analysis non trovata nel manifest")
    write_text_atomic(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def copy_release_docs(repo: Path, package: Path) -> None:
    payload = package / "_payload"
    for name in GENERATED_DOCS:
        shutil.copy2(payload / name, repo / name)


def write_checksums(repo: Path) -> None:
    rels = TARGETS + [Path("tools/manifest.json")] + [Path(x) for x in GENERATED_DOCS]
    lines = []
    for rel in rels:
        path = repo / rel
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        lines.append(f"{digest}  {rel.as_posix()}")
    write_text_atomic(repo / "SHA256SUMS-v6.15.6.txt", "\n".join(lines) + "\n")


def apply(repo: Path, package: Path) -> None:
    main_target = repo / TARGETS[0]
    if not (repo / ".git").exists():
        raise RuntimeError("La cartella indicata non sembra la root del repository: manca .git")
    if not main_target.exists():
        raise RuntimeError(f"File non trovato: {main_target}")

    hotfix_js = read_text(package / "_payload" / "financial-analysis-xlsx-hotfix-v2.0.5.js")
    statuses = []
    for rel in TARGETS:
        path = repo / rel
        if not path.exists():
            raise RuntimeError(f"Copia linguistica mancante: {rel.as_posix()}")
        backup_file(repo, package, rel)
        statuses.append((rel, patch_html(path, hotfix_js)))

    update_manifest(repo, package)
    copy_release_docs(repo, package)
    write_checksums(repo)

    print("\nHotfix applicata correttamente.")
    for rel, status in statuses:
        print(f"- {rel.as_posix()}: {status}")
    print("- tools/manifest.json: release v6.15.6 / Financial Analysis 2.0.5")
    print("- Documentazione e checksum: generati")
    print(f"- Backup originali: {package / '_backup'}")


def rollback(repo: Path, package: Path) -> None:
    backup = package / "_backup"
    if not backup.exists():
        raise RuntimeError("Backup non trovato: non è possibile eseguire il rollback automatico")
    restored = 0
    for source in backup.rglob("*"):
        if source.is_file():
            rel = source.relative_to(backup)
            target = repo / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
            restored += 1
    for name in GENERATED_DOCS + ["SHA256SUMS-v6.15.6.txt"]:
        path = repo / name
        if path.exists():
            path.unlink()
    print(f"Rollback completato. File ripristinati: {restored}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Applica la hotfix XLSX Financial Analysis v2.0.5")
    parser.add_argument("repository", help="Percorso della root del repository tax-automation-lab")
    parser.add_argument("--rollback", action="store_true", help="Ripristina i file originali dal backup")
    args = parser.parse_args()
    repo = Path(args.repository).expanduser().resolve()
    package = Path(__file__).resolve().parent
    try:
        if args.rollback:
            rollback(repo, package)
        else:
            apply(repo, package)
        return 0
    except Exception as exc:
        print(f"\nERRORE: {exc}", file=sys.stderr)
        print("Nessun push è stato eseguito. Controllare il percorso e riprovare.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
