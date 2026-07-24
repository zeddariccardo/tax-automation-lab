# Audit remediation report — Tax Automation Lab v6.5.0

**Date:** 24 July 2026  
**Working base:** v6.4.0 AI Onboarding, itself derived from the definitive v6.3.5 package  
**Primary constraint:** preserve all functions, tool versions, file formats and content introduced by the latest releases.

## Method

The findings were checked against the package, not inferred from the public deployment. Static HTML, metadata, Unicode code points, links, embedded-library declarations, tool scripts and downloadable templates were inspected. Corrections were limited to the publication shell, metadata, legal/editorial content and progressive navigation unless explicitly stated otherwise.

The operational JavaScript blocks of Financial Statement v1.1.1, TFA Client File v1.5.3 and LIPE v3.2.3 were compared before and after remediation and remain byte-identical.

## P1 — blocking findings

| ID | Assessment on v6.4.0 | v6.5.0 action |
|---|---|---|
| P1-01 | **Confirmed.** A long U+200B/U+200C/U+FEFF sequence was present in the TFA disclaimer in all three languages. | Removed the suspicious long payload only. Two isolated Unicode code points belonging to the vendored spreadsheet code were deliberately retained. Added an automated rejection test for long zero-width sequences. |
| P1-02 | **Partly confirmed.** hreflang tags were already present in v6.4.0, but most language controls were buttons relying on JavaScript. | Converted every language control into a real `<a href>` while retaining the existing JavaScript routing as progressive enhancement. Normalised hreflang and x-default links. |
| P1-03 | **Confirmed.** The tools still embed SheetJS CE 0.18.5 and read user-supplied spreadsheets. | **Not silently patched in this website release.** A safe correction requires the official 0.20.3 build to be vendored into each monofile tool, followed by full import/export regression testing, regenerated release assets, notices and checksums. Replacing it with an unverified mirror or remote CDN dependency would undermine the current offline/single-file model. This remains the only confirmed P1 dependency item intentionally deferred to a dedicated tool release. |
| P1-04 | **Confirmed.** The literal text `html` preceded multiple EN/ES institutional pages. | Removed from every affected page and covered by the static audit script. |

## P2 — high-priority findings

| ID | Assessment | Action |
|---|---|---|
| P2-01 | Confirmed on six EN/ES articles. | `og:url` is now self-referential and matches canonical. |
| P2-02 | Confirmed on the same articles. | `og:description` now uses the localised page description. |
| P2-03 | Confirmed on tool and insight pages. | Added social preview image metadata, dimensions, alt text, locale and Twitter cards. |
| P2-04 | **Already corrected in v6.4.0.** The three homepages already contained the two correct alternate locales. | Re-normalised systematically; no product change. |
| P2-05 | Confirmed for the three TFA articles. | Added complete Open Graph, Twitter and author metadata. |
| P2-06 | Confirmed for tool catalogues, tool shells and TFA articles. | Restored complete legal/independence footers and links. Tool-internal footers were not removed. |
| P2-07 | Confirmed: the privacy text was only a short summary. | Expanded in IT/EN/ES with controller/contact, purposes and legal bases, technical providers, retention, recipients, rights, complaint and no automated decisions. This is an operational privacy notice and should still be reviewed if the infrastructure or contact workflow changes. |
| P2-08 | Confirmed. | Added a 24 July 2026 revision date to Privacy, Security, Terms and Licences in all languages. |
| P2-09 | **The deployment-specific Cloudflare placeholder was not reproducible in the package.** Addresses were plain text in all languages. | Standardised privacy and security addresses as explicit `mailto:` links. |
| P2-10 | Confirmed as a package gap. | Added a trilingual `404.html` and an `/it/` compatibility redirect page. A true HTTP 301 for `/it/*` must be configured in Cloudflare/GitHub hosting rules; static files alone cannot emit a server-side 301. |
| P2-11 | Confirmed. | The homepage year now has a static `2026` fallback while retaining runtime updating. |
| P2-12 | Partly confirmed. | Tool catalogue and publication-shell navigation now include Tools, Insights, AI configuration, Guide and Licences. Homepage route navigation remains intentionally different because it controls the single-page sections. |

## P3 — consistency findings

| ID | Decision | Rationale / action |
|---|---|---|
| P3-01 | Deferred | Slug migration requires controlled redirects and search-index management; no URLs were renamed. |
| P3-02 | Deferred | `/en/licenses/` was preserved to avoid a breaking URL change. Visible English continues to use “Licences”. |
| P3-03 | Applied | `04 · Smentire` corrected to `4 · Smentire`. |
| P3-04 | Retained | The longer first method label is an editorial design choice and does not create a functional defect. |
| P3-05 | Deferred | Tool section numbering is tied to the current UI and was not changed in a non-functional maintenance release. |
| P3-06 | Deferred | TFA sidebar grouping affects navigation behaviour and requires a dedicated UX regression cycle. |
| P3-07 | Deferred | Example-button wording was left unchanged to avoid altering established instructions and screenshots. |
| P3-08 | Deferred | Reset controls have different scopes; forcing one label could be misleading without redesigning confirmations. |
| P3-09 | Deferred | JSON exports genuinely have different perimeters; labels should be addressed in the next tool-specific releases. |
| P3-10 | Deferred | Operational TFA labels were not edited in order to keep tool scripts and documentation alignment intact. |
| P3-11 | Applied where safe | Guide links now identify the file as **v4** and as an Italian PDF in EN/ES. A versioned copy is included while the old stable file remains for compatibility. |
| P3-12 | Applied | First tool-suite CTAs in EN/ES now show `(IT)`. |
| P3-13 | Partly applied | Publication shell, navigation and legal footer are localised. The operational tool interface remains Italian by deliberate product choice. |
| P3-14 | Retained | Product category claims were not re-positioned in this maintenance release. |
| P3-15 | Partly applied | H1 separators were normalised to an em dash; DOM order was left untouched to avoid layout risk. |
| P3-16 | Deferred | Global apostrophe replacement could corrupt embedded JavaScript; it should be handled in source templates before regeneration. |
| P3-17 | Applied | Tool viewports now use `viewport-fit=cover`; title and social title are aligned. |
| P3-18 | Applied | Home image alt text and social-image alt text are localised. |
| P3-19 | Partly applied | Social descriptions now match each local meta description. Broader editorial equivalence is retained for a translation review. |
| P3-20 | Partly applied | Confirmed LIPE uses of “exception” were corrected to “anomaly”. A full terminology glossary remains recommended. |
| P3-21 | Deferred | Cross-tool terminology should be changed together with tool UI documentation. |
| P3-22 | Deferred | Version badges were not redesigned; all existing version numbers remain correct. |
| P3-23 | Partly applied | TFA index heading is aligned with the other articles; existing return links were preserved. No H1/title rewrite was forced. |
| P3-24 | Applied | Italian intro CTA changed from “Start” to “Entra”. |
| P3-25 | Retained | “Generatore LIPE” remains the site-facing product name and `TaxTool_LIPE` remains the release filename. Renaming requires a product decision. |

## P4 — editorial / low-priority findings

| ID | Decision | Action |
|---|---|---|
| P4-01 | Applied | The packaged PDF was verified byte-for-byte against the supplied v4. A versioned copy and v4 labels were added; the stable old path is retained. |
| P4-02 | Deferred | Rebuilding the PDF index requires a dedicated guide source/editing release. |
| P4-03 | Deferred | Footer and pagination changes require rebuilding the guide PDF. |
| P4-04 | Applied | Added a terminology note explaining that “IV Direttiva” is a recognisable commercial label while the tool applies the current Italian statutory schemes and Directive 2013/34/EU framework. |
| P4-05 | Applied in the relevant pages | LIPE and IVP18 are explained; OIC is expanded in EN/ES financial-statement insights. |
| P4-06 | Applied | Spanish “mappings” replaced with “mapeos”. |
| P4-07 | Deferred | Expanding the TFA article is a content project, not a defect correction. |
| P4-08 | Applied | Italian insights-index description now includes TFA Client File. |
| P4-09 | Deferred | Cross-tool feature parity is a product roadmap item; adding functions would violate the no-functionality-change constraint. |

## Regression evidence

- 48 HTML files pass `scripts/site_audit.py`.
- 115 inline JavaScript blocks pass `node --check`.
- Core scripts in the three Italian tool monofiles are byte-identical to v6.4.0 after remediation.
- AI onboarding Excel templates open successfully and retain the required sheet names and headers.
- Financial Statement and LIPE template labels are present in the corresponding tool import logic.
- The stable and versioned v4 guide PDFs have the same SHA-256 hash.

## Known limitation of this validation environment

Headless Chromium navigation is blocked by the execution environment’s administrator policy. Interactive click/upload/download testing could therefore not be rerun here. The absence of operational code changes, byte-level script comparison, JavaScript syntax checks, template validation and static link checks provide the regression basis for this release. A final browser smoke test on the deployed GitHub Pages preview remains recommended before merging to production.
