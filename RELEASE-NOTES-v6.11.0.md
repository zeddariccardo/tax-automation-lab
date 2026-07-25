# Tax Automation Lab v6.11.0 — LIPE reliability and interface cleanup

**Release date:** 25 July 2026

## LIPE Generator v3.3.0

This release addresses a functional audit of LIPE v3.2.5 and focuses on preventing silent errors in period carry-forwards, imports and official outputs.

### Period carry-forwards

- Credits from the previous VAT period are proposed automatically in VP8 within the same tax year.
- VAT debts not exceeding the current minimum-payment threshold of **EUR 100** are proposed automatically in VP7 of the following period.
- Automatic carry-forward stops at year end; prior-year credits remain a professional input for VP9.
- The first module of quarters 2–4 can recover the immediately preceding result from the saved client history.
- Automatic values remain manually overridable and are labelled as calculated or overridden.
- VP7 above EUR 100 and simultaneous VP7/VP8 values are blocking errors.

### Import reliability

- Required columns are matched only against exact, controlled aliases.
- Missing or ambiguous columns now block import instead of being guessed.
- Italian and international thousands/decimal separators are parsed consistently.
- Text dates in `dd/mm/yyyy` and ISO formats are assigned to the correct month.
- Changing quarter or client periodicity triggers confirmation and revalidates every imported row.
- Rows outside the selected period are blocking errors.
- Re-importing period amounts preserves manual VP values.

### Calculation, persistence and output

- Amounts are rounded to two decimals before the VP14 balance is calculated, so UI, PDF and XML use the same figures.
- Period rows, manual values, selected year/quarter and source information are restored from local browser storage.
- Local-storage quota failures are reported to the user.
- The XML uses the current `VersamentiAuto` element and omits incompatible fields for VAT-group cases.
- The official-style PDF preserves negative amounts, prints numeric exceptional-event codes, includes the extraordinary-operation flag and completes the available front-page data.
- VP12 and VP13 receive period-appropriateness checks; the tool does not infer the 1% quarterly interest when the necessary taxpayer option is not documented.
- VAT-number renaming and overwriting require confirmation; check-digit issues are reported before saving.

## Website and onboarding

- Every practical tool case ends with one clear action: open the relevant tool.
- TFA onboarding screenshots have been resized into a proportionate responsive layout.
- The former green square favicon has been replaced by the ivory `RZ` monogram used in the site identity.
- The introductory copy no longer starts the final sentence with “E / And / Y”.
- LIPE descriptions and the practical case now explain automatic carry-forwards and stricter import controls in Italian, English and Spanish.

## Compatibility

- Existing LIPE client mappings and saved histories remain compatible.
- Existing Financial Statement v1.1.3 and TFA Client File v1.6.3 application logic is unchanged.
- SheetJS CE remains at the verified official standalone build 0.20.3.
- All processing remains local in the browser.

## Deliberately deferred

- A single tax code feeding both VP2 and VP3 is not introduced in this release.
- Historical summaries remain exportable but are not converted into a general editing archive; current work is instead restorable automatically.
- Monthly taxpayers continue to display the three modules belonging to the selected quarter.
- The 1% quarterly interest is validated but not calculated automatically without an explicit configuration distinguishing quarterly-by-option taxpayers.
