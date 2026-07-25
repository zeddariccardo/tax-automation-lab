# LIPE v3.3.0 — critical review of the v3.2.5 audit

The external audit was used as a test plan rather than applied mechanically. The audit correctly identified a number of silent-error risks, but its proposed VP7 threshold of EUR 25.82 was obsolete. The model and technical specifications applicable from 2024 use EUR 100.

| Audit point | Assessment | v3.3.0 treatment |
|---|---|---|
| 1. No automatic VP7/VP8 carry-forward | Confirmed, blocking | Automatic same-year carry-forward; first period of Q2–Q4 may use saved prior-quarter history; manual override is visible. |
| 2. VP7 limit and coexistence with VP8 | Confirmed, threshold updated | VP7 is limited to EUR 100, not EUR 25.82; VP7 and VP8 together are blocking. |
| 3. Small VAT debt not managed | Confirmed | Debts up to EUR 100 are carried to the following period, subject to the year-end stop. |
| 4. Quarter/periodicity changes silently zero results | Confirmed | Confirmation, revalidation and blocking “rows outside period” check added. |
| 5. Ambiguous column lookup | Confirmed | Exact controlled aliases; missing or ambiguous required columns block import. |
| 6. Thousands separator parsed as decimals | Confirmed | Italian and international number formats supported. |
| 7. Day read as month | Confirmed | `dd/mm/yyyy`, `yyyy-mm-dd`, month names and month numbers handled explicitly. |
| 8. XML rounding inconsistency | Confirmed | Two-decimal rounding occurs before balance calculation and is reused across outputs. |
| 9. Official PDF issues | Largely confirmed | Negative signs, numeric event code, extraordinary-operation flag and available front-page fields corrected. Signature boxes remain intentionally blank. |
| 10. VAT-group incompatible fields | Confirmed | Blocking controls and conditional XML omission added for participant and parent cases. |
| 11. Manual VP values lost on re-import | Confirmed | Manual values are preserved and the user is informed. |
| 12. Work period not persistent | Confirmed | Rows, manual values, year, quarter, source and draft mappings are stored locally by client/period. |
| 13. VP12 / VP13 support | Partially confirmed | Invalid periods are blocked. Automatic 1% interest is intentionally deferred because the tool does not yet store the quarterly-by-option condition. |
| 14. Silent VAT-number rename/overwrite | Confirmed | Explicit confirmations added. |
| 15. VAT-number checks misaligned | Confirmed | Check-digit warning added at save time; XML validation remains blocking. |
| 16a. Storage quota failure | Confirmed | Storage writes are caught and reported. |
| 16b. History cannot be reopened | Improvement, not blocking | Current work is restorable; historical summaries remain immutable/exportable. |
| 16c. Three monthly modules always generated | Not treated as a defect | The selected quarter continues to expose its three monthly modules. |
| 16d. Implied-rate plausibility test | Deferred | Not added because mixed/partial deductibility and special transactions can produce false positives; strict column and period checks address the demonstrated silent errors. |
| 16e. One taxable-base destination per tax code | Product limitation | Preserved for compatibility; a multi-destination mapping requires a dedicated schema migration. |

## Current technical-specification alignment

- VP7 label and validation use the EUR 100 threshold.
- VP10 is labelled “Versamenti auto F24 elementi identificativi”.
- The XML element is `VersamentiAuto`, replacing the obsolete `VersamentiAutoUE` name.
- Exceptional-event values offered by the interface are 1 and 9.

## Professional review boundary

The tool accelerates reconstruction and validation but does not determine the taxpayer’s legal treatment. Manual overrides, VAT-group positions, VP9, advance-payment method and exceptional-event data remain subject to professional verification before filing.
