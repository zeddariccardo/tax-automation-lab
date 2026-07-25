# Tax Automation Lab v6.9.0 — Financial Statement totals, SheetJS update and consistency remediation

**Release date:** 25 July 2026

## Functional correction

- Financial Statement updated to **v1.1.2**.
- Explicit **Totale attivo** and **Totale passivo** rows are included in the on-screen Balance Sheet, Excel working paper, all three PDF export modes and the blank statutory-schema PDF.
- Current and comparative periods are shown in every populated output.
- The balance totals continue to feed the existing A = P control and archive exports.

## Excel engine security and maintenance update

- SheetJS Community Edition updated from **0.18.5** to the official standalone build **0.20.3**.
- The library remains embedded in every operational HTML file: the tools continue to work locally, offline and as single-file applications.
- TFA Client File updated to **v1.6.2** and LIPE updated to **v3.2.4** to identify the changed distributed binaries.
- Official build checksums recorded in `legal-docs/THIRD-PARTY-NOTICES.txt`.

## Safe audit remediation

- Clear and consistent scope labels for JSON exports.
- Consistent example-loading labels.
- Clearer TFA export actions and section numbering.
- Unified product-category claims across the three tools.
- Expanded TFA practical case covering AI-assisted Excel onboarding and the Other/Altro section.
- Consistent tool-version badges and return navigation on tool-linked articles.
- Selective visible-text apostrophe normalisation without rewriting application logic.

## Compatibility

- Existing browser archives and JSON backups remain compatible.
- Excel template structures are unchanged.
- No server-side processing or external runtime dependency has been introduced.

## Separate post-deployment items

- HTTP 301 redirects for `/it/*` require a Cloudflare redirect rule.
- Guide PDF index/footer rebuilding requires the editable guide source and is not part of this release.
