# Tax Automation Lab — site v6.5.0

Release date: 24 July 2026

## Included

- AI-assisted onboarding section introduced in v6.4.0, including Financial Statement and LIPE VAT-code templates, prompts and visual upload instructions.
- Verified remediation of publication-layer findings from the 24 July 2026 technical/editorial audit.
- Real language links plus hreflang, complete social metadata, corrected EN/ES generator residue, complete legal footers and static 404 support.
- Expanded privacy information and revision dates in Italian, English and Spanish.
- Guide explicitly identified as v4, with both stable and versioned file paths.
- Automated package check: `python scripts/site_audit.py`.
- Detailed decision log: `AUDIT-REMEDIATION.md`.

## Tool versions preserved

- Financial Statement v1.1.1
- TFA Client File v1.6.0
- LIPE v3.2.3

The operational JavaScript of all nine tool pages is unchanged from v6.4.0.

## Security dependency note

SheetJS CE 0.18.5 remains embedded in this website package. The confirmed upgrade to an official current build is intentionally reserved for a dedicated tool release with full file import/export regression tests and regenerated release assets. See `AUDIT-REMEDIATION.md`.
