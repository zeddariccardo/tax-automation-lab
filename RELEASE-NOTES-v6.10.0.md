# Tax Automation Lab v6.10.0 - audit remediation and accessibility hardening

**Release date:** 25 July 2026

## Confirmed corrections

- Corrected six locale-breaking links in the English and Spanish AI onboarding pages.
- Completed the legal footer on every AI onboarding page.
- Removed `?skipIntro=1` from internal URLs and retained intro skipping through session state.
- Added localised redirect aliases and a path-aware multilingual 404 page.
- Added explicit disclosure that the operational tool UI is in Italian on EN and ES tool pages.
- Improved language-selector semantics and decorative-icon accessibility.
- Added article dates, article metadata, brand-consistent titles, semantic anchors and consistent return actions.
- Aligned LIPE sidebar numbering and wording with the five body sections.
- Standardised TFA creation and archive labels and corrected visible wording.
- Expanded Terms and improved the Spanish privacy complaint information.
- Added `/.well-known/security.txt`.
- Added real IT/EN/ES guide landing pages and made the unversioned PDF URL canonical.
- Rebuilt the guide index, numbered the divider page, corrected the leasing wording and added a CC BY-NC-ND 4.0 licence page.

## Tool versions

- Financial Statement **v1.1.3**
- TFA Client File **v1.6.3**
- Generatore LIPE **v3.2.5**
- SheetJS CE remains **v0.20.3**

## Findings verified as already resolved or stale

Cache-dependent privacy, metadata, version and zero-width-character findings were already resolved in the v6.9.0 source and were rechecked in this release.

## Deliberate decisions / deferred migrations

- The Spanish `/es/tools/` slug is retained to avoid breaking indexed URLs.
- Operational fields remain in Italian because the tools implement Italian statutory workflows; the limitation is now disclosed before the app.
- The reference to Verdalia Bioenergy being founded by Goldman Sachs is retained as an intentional biographical fact requested by the author.
- The versioned guide PDF remains as a compatibility copy; public links use the stable unversioned landing and PDF URL. A true 301 for the old PDF filename requires a Cloudflare rule.
