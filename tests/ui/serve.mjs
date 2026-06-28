import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const port = Number(process.env.PORT || 8094);
const types = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
};

const server = createServer(async (request, response) => {
  const requestedPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const relativePath = requestedPath === "/" ? "tests/ui/kotonoha-mobile.html" : requestedPath.replace(/^\/+/, "");
  const filePath = normalize(join(root, relativePath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Kotonoha UI test page: http://127.0.0.1:${port}/tests/ui/kotonoha-mobile.html`);
});
