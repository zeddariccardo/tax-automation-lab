# Claude audit verification - v6.10.0 remediation

Audit basis: workbook supplied on 25 July 2026, checked against the actual v6.9.0 production source.

## Confirmed and corrected

`L-01`, `L-02`, `L-03`, `L-04`, `L-05`, `L-06`, `L-07`, `L-08`, `M-01`, `M-05`, `M-06`, `M-07`, `M-08`, `M-11`, `S-01`, `S-02`, `S-04`, `S-06`, `S-07`, `E-01`, `E-02`, `E-03`, `E-04`, `E-06`, `E-07`, `E-08`, `E-10`, `E-12`, `E-13`, `E-14`, `E-15`, `E-16`, `E-18`, `E-19`, `E-20`, `E-22`, `E-23`, `E-24`, `G-02`, `G-03`, `A-01`, `A-02`, `A-03`.

## Already resolved in v6.9.0 / stale cache observations

`C-01`, `C-02`, `C-03`, `C-04`, `M-02`, `M-03`, `M-04`, `S-03`, `S-05`, `G-01`.

The source was rechecked for: current tool versions, complete privacy notices, clean Open Graph URLs/descriptions, all-language hreflang alternatives, social preview metadata and absence of forbidden zero-width watermark characters.

## Partly remediated / architectural limitation

- `C-05`: all public links now use the stable guide landing and unversioned PDF URL. The versioned PDF is retained only as a compatibility copy; an HTTP 301 requires Cloudflare.
- `M-09`: the established `/es/tools/` URL is retained to avoid an unnecessary URL migration.
- `M-10`: Spanish navigation, CTA and onboarding terminology was normalised where it was unambiguous. Established professional vocabulary such as `mapping`, tax code and working paper is retained in technical contexts rather than replaced mechanically.
- `E-05`: the duplicated TFA groups are mode-specific and hidden conditionally, not simultaneous visible duplicates. Existing behaviour is preserved.
- `E-09`: “Financial Statement” is the product name and “Riclassifica IV Direttiva” is retained as a functional descriptor; this is documented rather than mechanically renamed.
- `E-11`: established professional terms (Commentary, working paper, open points, Preparer/Reviewer) are retained where they describe recognised audit workflow concepts; ambiguous actions were clarified.
- `E-17`: translations were reviewed for terminology, while preserving language-appropriate copy rather than imposing literal word-for-word identity.
- `E-21`: the Goldman Sachs reference is retained by explicit editorial decision of the author and does not imply sponsorship of Tax Automation Lab.

## Regression boundary

No accounting, tax, mapping, Excel, PDF, XML, archive or localStorage calculation logic was intentionally changed. Changes are limited to public-page links, metadata, visible labels, accessibility attributes, legal copy, guide PDF presentation and distributed patch versions.
