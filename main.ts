import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

console.log("Starting Aegis server on Deno...");

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // API Health and Mock Endpoints for Deno Deploy
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/auth/me") {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ status: "ok", service: "Aegis Deno API" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Serve static files from dist directory
  try {
    const res = await serveDir(req, {
      fsRoot: "dist",
      quiet: true,
    });

    if (res.status === 404) {
      try {
        const indexHtml = await Deno.readFile("dist/index.html");
        return new Response(indexHtml, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      } catch {
        return new Response("Aegis App on Deno: Frontend build (dist) not found. Please run vite build.", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }
    }

    return res;
  } catch (_err) {
    return new Response("Aegis App running on Deno", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
});
