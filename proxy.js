#!/usr/bin/env node
'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { URL } = require('url');

const PORT = 7070;

// ── Script injected into every proxied HTML page ─────────────
// Intercepts link clicks (routes them through the proxy so navigation
// stays inside the iframe) and window.open calls (posts a message to
// the parent app so a new floating frame is opened instead).
const INJECT = `<script>(function(){
var BASE="http://localhost:${PORT}/proxy?url=";
document.addEventListener("click",function(e){
  var a=e.target&&e.target.closest&&e.target.closest("a[href]");
  if(!a)return;
  var abs=a.href;
  if(!abs||/^(#|javascript:|mailto:|tel:)/i.test(abs))return;
  if(abs.indexOf("localhost:${PORT}")>=0||abs.indexOf("127.0.0.1:${PORT}")>=0)return;
  e.preventDefault();e.stopPropagation();
  window.location.href=BASE+encodeURIComponent(abs);
},true);
var _op=window.open;
window.open=function(u,t,f){
  if(u&&!/^javascript:/i.test(u)){
    try{
      var abs=new URL(u,location.href).href;
      if(window.parent&&window.parent!==window){
        window.parent.postMessage({type:"frames:open",url:abs},"*");
        return null;
      }
    }catch(ex){}
  }
  return _op&&_op.apply(this,arguments);
};
})();</script>`;

// ── Fetch with redirect following ────────────────────────────
function fetchUrl(targetUrl, hops) {
  return new Promise((resolve, reject) => {
    if (hops > 8) return reject(new Error('Too many redirects'));
    let parsed;
    try { parsed = new URL(targetUrl); }
    catch(e) { return reject(new Error('Invalid URL: ' + targetUrl)); }

    const mod  = parsed.protocol === 'https:' ? https : http;
    const port = parsed.port ? Number(parsed.port)
                             : (parsed.protocol === 'https:' ? 443 : 80);

    const req = mod.request({
      hostname: parsed.hostname,
      port,
      path: (parsed.pathname || '/') + parsed.search,
      method: 'GET',
      headers: {
        'user-agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'identity',   // avoid compressed responses
        'cache-control':   'no-cache',
        'connection':      'close',
      },
      timeout: 20000,
      rejectUnauthorized: false,         // allow self-signed certs (local dev)
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, targetUrl).href;
        res.destroy();
        return resolve(fetchUrl(next, hops + 1));
      }
      resolve({ res, finalUrl: targetUrl });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.end();
  });
}

// ── Strip headers that block iframe embedding ────────────────
function filterHeaders(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const kl = k.toLowerCase();
    if (kl === 'x-frame-options')                       continue; // drop entirely
    if (kl === 'content-encoding')                      continue; // we asked identity
    if (kl === 'transfer-encoding')                     continue; // Node handles this
    if (kl === 'content-security-policy' ||
        kl === 'content-security-policy-report-only') {
      // Keep the directive but remove frame-ancestors and upgrade-insecure-requests
      const val = Array.isArray(v) ? v.join('; ') : v;
      const cleaned = val
        .replace(/frame-ancestors\s+[^;]*(;|$)\s*/gi, '')
        .replace(/upgrade-insecure-requests\s*(;|$)\s*/gi, '')
        .trim().replace(/;\s*$/, '');
      if (cleaned) out[k] = cleaned;
      continue;
    }
    out[k] = v;
  }
  return out;
}

// ── HTTP server ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── Serve the app shell ──────────────────────────────────────
  if (u.pathname === '/' || u.pathname === '/index.html') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8',
                           'Cache-Control': 'no-store' });
      res.end(html);
    } catch(e) {
      res.writeHead(500); res.end('Cannot read index.html: ' + e.message);
    }
    return;
  }

  // ── Proxy endpoint: GET /proxy?url=https://… ─────────────────
  if (u.pathname === '/proxy') {
    const target = u.searchParams.get('url');
    if (!target) { res.writeHead(400); res.end('Missing ?url= parameter'); return; }

    console.log('→', target);

    try {
      const { res: pr, finalUrl } = await fetchUrl(target, 0);
      const headers = filterHeaders(pr.headers);
      headers['access-control-allow-origin'] = '*';

      const ct      = (headers['content-type'] || '').toLowerCase();
      const isHtml  = ct.includes('text/html') || ct.includes('application/xhtml');

      if (isHtml) {
        // Buffer the whole page so we can inject tags
        const chunks = [];
        pr.on('data', c => chunks.push(c));
        pr.on('end', () => {
          let html = Buffer.concat(chunks).toString('utf8');

          // Remove any <meta http-equiv="Content-Security-Policy"> tags
          html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');

          // Inject <base href> + intercept script right after <head>
          const injection = `<base href="${finalUrl}">${INJECT}`;
          if (/<head(\s[^>]*)?>/.test(html)) {
            html = html.replace(/(<head(\s[^>]*)?>)/i, `$1${injection}`);
          } else {
            html = injection + html;
          }

          delete headers['content-length'];
          res.writeHead(pr.statusCode || 200, {
            ...headers,
            'content-type': 'text/html; charset=utf-8',
          });
          res.end(html, 'utf8');
        });
        pr.on('error', () => { res.writeHead(502); res.end('Upstream stream error'); });
      } else {
        // Images, CSS, JS, fonts — stream through unchanged
        res.writeHead(pr.statusCode || 200, headers);
        pr.pipe(res);
      }

    } catch(err) {
      console.error('Proxy error:', err.message);
      const msg = `<html><body style="font:15px system-ui;padding:2rem;background:#0d1117;color:#f85149">
        <h2 style="margin-bottom:.5rem">Could not load page</h2>
        <p style="color:#8b949e">${err.message}</p>
        <p style="margin-top:1rem;font-size:12px;color:#484f58">${target}</p>
      </body></html>`;
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(msg);
    }
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ⊞  Frames  →  http://localhost:${PORT}\n`);
});
