import { extname } from "https://deno.land/std@0.224.0/path/mod.ts";

const MEDIA_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

console.log("Starting Aegis Deno Production Server...");

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // API endpoints mockup / handlers
  if (url.pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ status: "ok", message: "Aegis Deno API" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Normalize path for static files inside dist/
  let filePath = `dist${url.pathname}`;
  if (url.pathname === "/" || url.pathname === "") {
    filePath = "dist/index.html";
  }

  try {
    const fileInfo = await Deno.stat(filePath);
    if (fileInfo.isDirectory) {
      filePath = `${filePath}/index.html`;
    }
    
    const fileContent = await Deno.readFile(filePath);
    const ext = extname(filePath);
    const contentType = MEDIA_TYPES[ext] || "application/octet-stream";

    return new Response(fileContent, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  } catch {
    // SPA Fallback to index.html for client-side routing (prevents blank screen)
    try {
      const indexHtml = await Deno.readFile("dist/index.html");
      return new Response(indexHtml, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch {
      return new Response(
        "Aegis App on Deno: Frontend build (dist) not found. Please ensure 'npm run build' executed successfully.",
        {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }
      );
    }
  }
});
