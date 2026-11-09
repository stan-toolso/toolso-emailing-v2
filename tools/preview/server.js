/**
 * Serveur de l'aperçu : joue le rôle de nginx sur un seul port ($PORT) sans dépendance externe.
 *   /access/graphql  → access (4000)
 *   /api/<uid>/…     → api (4001), préfixe retiré
 *   /files/<uid>/…   → fichiers exportés de l'instance
 *   /…               → build statique de l'UI (fallback index.html pour le HashRouter)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

const proxy = (req, res, { port, path: targetPath }) => {
  const upstream = http.request(
    { host: '127.0.0.1', port, method: req.method, path: targetPath, headers: { ...req.headers, host: `127.0.0.1:${port}`, 'x-forwarded-proto': 'http', 'x-forwarded-host': req.headers.host ?? '' } },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );
  upstream.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Upstream on port ${port} unavailable: ${err.message}`);
  });
  req.pipe(upstream);
};

const serveFile = (res, filePath, fallback) => {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      if (fallback) {
        return serveFile(res, fallback, null);
      }
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'content-type': MIME[ext] ?? 'application/octet-stream', 'content-length': stat.size };
    if (filePath.includes(`${path.sep}static${path.sep}`)) {
      headers['cache-control'] = 'public, max-age=31536000, immutable';
    } else {
      headers['cache-control'] = 'no-cache';
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
};

const createServer = ({ uiDir, filesDir, uid, accessPort = 4000, apiPort = 4001 }) =>
  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/access/graphql') {
      return proxy(req, res, { port: accessPort, path: `/graphql${url.search}` });
    }
    if (url.pathname === '/access/health') {
      return proxy(req, res, { port: accessPort, path: '/health' });
    }
    const apiPrefix = `/api/${uid}`;
    if (url.pathname === apiPrefix || url.pathname.startsWith(`${apiPrefix}/`)) {
      const rest = url.pathname.substring(apiPrefix.length) || '/';
      return proxy(req, res, { port: apiPort, path: `${rest}${url.search}` });
    }
    const filesPrefix = `/files/${uid}/`;
    if (url.pathname.startsWith(filesPrefix)) {
      const relative = path.normalize(decodeURIComponent(url.pathname.substring(filesPrefix.length))).replace(/^(\.\.[/\\])+/, '');
      return serveFile(res, path.join(filesDir, relative), null);
    }
    const relative = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    const target = path.join(uiDir, relative === path.sep || relative === '/' ? 'index.html' : relative);
    return serveFile(res, target, path.join(uiDir, 'index.html'));
  });

module.exports = { createServer };
