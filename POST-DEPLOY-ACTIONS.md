# Post-deployment actions

## Cloudflare redirect

Configure a permanent redirect for `/it/*` to the corresponding root-language URL. This is a hosting configuration and cannot be implemented in the static GitHub Pages package.

## Guide source

The guide PDF was not destructively edited. Index, footer and pagination changes should be made in the editable source and the PDF regenerated in a separate release.

## Production smoke test

After GitHub Pages reports a successful deployment and any Cloudflare cache purge is complete, test the Financial Statement, TFA and LIPE Excel imports in a private browser window.
