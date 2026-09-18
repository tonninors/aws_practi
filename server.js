/*
 * Servidor estático mínimo (sin dependencias) para servir el repo en local.
 * Imita el comportamiento de Cloudflare Pages en producción: sirve cualquier
 * archivo por su ruta real y, si la ruta no tiene extensión, intenta
 * `<ruta>.html` (URLs limpias como /guia-ai-practitioner).
 * El login (código por correo) y el progreso por usuario/examen los maneja
 * el cliente con Supabase (ver shared/app.js y window.EXAM_META en cada
 * guia-*.html).
 *
 * Uso:
 *   node server.js
 *   luego abre http://localhost:8787 (o el túnel/host público)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8787;
const ROOT = __dirname;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function resolverArchivo(urlPath, cb) {
  const limpio = urlPath === "/" ? "/index.html" : urlPath;
  const candidato = path.normalize(path.join(ROOT, limpio));
  if (!candidato.startsWith(ROOT)) { cb(null); return; } // evita path traversal

  fs.stat(candidato, (err, stats) => {
    if (!err && stats.isFile()) { cb(candidato); return; }
    if (path.extname(candidato) === "") {
      const conHtml = candidato + ".html";
      fs.stat(conHtml, (err2, stats2) => {
        cb(!err2 && stats2.isFile() ? conHtml : null);
      });
      return;
    }
    cb(null);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Método no permitido");
    return;
  }
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  resolverArchivo(urlPath, (archivo) => {
    if (!archivo) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("No encontrado");
      return;
    }
    const tipo = TIPOS[path.extname(archivo)] || "application/octet-stream";
    fs.readFile(archivo, (err, data) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("No se pudo leer el archivo");
        return;
      }
      res.writeHead(200, { "Content-Type": tipo });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Guías AWS disponibles en http://localhost:${PORT}`);
});
