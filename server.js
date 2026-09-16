/*
 * Servidor mínimo (sin dependencias) para servir la guía AIF-C01.
 * El login (magic link por correo) y el progreso por usuario se
 * manejan del lado del cliente con Supabase (ver constantes
 * SUPABASE_URL / SUPABASE_ANON_KEY en guia-ai-practitioner.html).
 *
 * Uso:
 *   node server.js
 *   luego abre http://localhost:8787 (o el túnel/host público)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8787;
const HTML_PATH = path.join(__dirname, "guia-ai-practitioner.html");

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  if (req.method === "GET" && (url === "/" || url === "/guia-ai-practitioner.html")) {
    fs.readFile(HTML_PATH, (err, data) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("No se pudo leer guia-ai-practitioner.html");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("No encontrado");
});

server.listen(PORT, () => {
  console.log(`Guía AIF-C01 disponible en http://localhost:${PORT}`);
});
