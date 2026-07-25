# Post-deployment actions - v6.10.0

## 1. GitHub Pages and Cloudflare smoke test

After the GitHub Pages deployment is green, purge the Cloudflare cache for `taxautomationlab.com`, close existing browser tabs and verify the site in a private window. Test the home page, the three AI-onboarding pages, and Excel import/export in Financial Statement, TFA and LIPE.

## 2. Recommended Cloudflare cache policy

Avoid long-lived edge caching for HTML documents. Keep long caching only for versioned or stable static assets (images, PDFs, fonts and downloads). This reduces the risk of the domain serving an older HTML build after a deployment.

## 3. Permanent redirects

The static package includes compatibility pages, but true HTTP redirects require Cloudflare rules:

- `/it/*` -> the corresponding Italian root-language URL;
- `/resources/Guida_Automazione_Processi_Fiscali_v4.pdf` -> `/resources/guida-automazione-processi-fiscali.pdf` (optional compatibility cleanup).

Use permanent redirects only after confirming that the destination URLs are live.

## 4. Production functional checks

- Financial Statement: import the example, verify Total assets and Total liabilities in UI, Excel and PDF.
- TFA: import the test workbook, verify Analytical, Commentary and Other, save to archive and reopen.
- LIPE: import mapping and period values, verify VP output and working paper.
- Open browser developer tools and confirm that no red errors appear during import or export.

## 5. Search Console

After production validation, resubmit the sitemap and request re-indexing for the home page, AI configuration page, tool pages and the new guide landing pages.
