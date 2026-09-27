// Loopback-only static preview. No API proxy and no production deployment.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { validateConfig } from './auth-context-service.js';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
let config = null;
try { config = validateConfig((await import(pathToFileURL(path.join(dir, 'config.local.js')).href)).default); }
catch { /* Missing local configuration is a supported screen, not a 404. */ }
const prefix = '/tools/forfettario-saas/';
const allowed = new Set(['index.html', 'app.js', 'app.css', 'mark.svg', 'demo-service.js', 'auth-runtime.js', 'auth-context-service.js', 'auth-view.js', 'tal-data-service.js', 'tal-data-runtime.js', 'income-model.js', 'income-controller.js', 'fiscal-controller.js', 'fiscal-view.js', 'collaboration-service.js', 'collaboration-controller.js', 'collaboration-view.js', 'collaboration-ui.js']);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
const connections = config ? config.supabaseUrl + '/auth/v1/ ' + config.supabaseUrl + '/rest/v1/rpc/tal_list_my_contexts' + ["tax_workspace","economic_activity","tax_year","studio","studio_client_link","studio_client_private","invoice","invoice_component","payment","allocation","rpc/tal_create_invoice","rpc/tal_record_payment","rpc/tal_record_pension_payment","document","activity_feed_item","rpc/tal_post_activity","rpc/tal_reserve_document","rpc/tal_finalize_document","rpc/tal_advance_request","rpc/tal_delete_document"].map(t => ' ' + config.supabaseUrl + '/rest/v1/' + t).join('') + " " + config.supabaseUrl + "/functions/v1/tal-calculate-fiscal" + ["/functions/v1/tal-verify-document-upload","/functions/v1/tal-download-document","/storage/v1/object/tal-documents/"].map(p=>" "+config.supabaseUrl+p).join("") : "'none'";
http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src " + connections + "; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    if (pathname === prefix + 'runtime-config.js') {
      res.setHeader('Content-Type', types['.js']);
      res.end(req.method === 'HEAD' ? undefined : 'export default ' + JSON.stringify(config) + ';');
      return;
    }
    const name = pathname === prefix ? 'index.html' : pathname.slice(prefix.length);
    const font = /^\/assets\/fonts\/[A-Za-z0-9/_-]+\.(css|woff2)$/.test(pathname);
    if (!(pathname.startsWith(prefix) && allowed.has(name)) && !font) { res.writeHead(404).end(); return; }
    const target = font ? path.join(root, pathname) : path.join(dir, name);
    const data = await readFile(target);
    res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404).end(); }
}).listen(Number(process.env.TAL_PREVIEW_PORT || 4174), '127.0.0.1', () => {
  console.log('TAL local preview: http://127.0.0.1:' + (process.env.TAL_PREVIEW_PORT || 4174) + prefix);
  console.log(config ? 'Public local configuration loaded.' : 'Local configuration missing or invalid; setup screen enabled.');
});
