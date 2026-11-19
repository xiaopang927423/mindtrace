import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("Web");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".mjs": "text/javascript",
};
http
  .createServer(async (req, res) => {
    try {
      const file = path.resolve(
        root,
        `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname === "/" ? "/index.html" : new URL(req.url, "http://localhost").pathname)}`,
      );
      if (!file.startsWith(`${root}/`)) throw new Error();
      res.setHeader(
        "Content-Type",
        types[path.extname(file)] || "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.statusCode = 404;
      res.end("Not found");
    }
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("UI preview: http://127.0.0.1:4173"),
  );
