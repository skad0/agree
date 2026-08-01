import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { registerPublicRoutes } from "./public.js";
import { registerAdminRoutes } from "./admin.js";
import { configureSecurity } from "./security.js";

export function createApp(options: { sqlitePath?: string; env?: NodeJS.ProcessEnv } = {}) {
  const config = loadConfig(options.env);
  configureSecurity(config);
  const db = openDatabase(options.sqlitePath ?? config.sqlitePath);
  const app = new Hono();

  app.use("*", async (context, next) => {
    (context as any).set("config", config);
    await next();
    if (!(context as any).get("downloadResponseFile")) context.header("Content-Security-Policy", "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; style-src 'self' https://cdn.jsdelivr.net; script-src 'self' https://cdn.jsdelivr.net https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com");
    context.header("Referrer-Policy", "strict-origin-when-cross-origin");
    context.header("X-Content-Type-Options", "nosniff");
    context.header("X-Frame-Options", "DENY");
    if (config.nodeEnv === "production") context.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  });
  app.use("*", bodyLimit({ maxSize: 11 * 1024 * 1024, onError: (context) => context.text("Request body too large", 413) }));

  app.get("/health", (context) => {
    db.prepare("SELECT 1").get();
    context.header("Cache-Control", "no-store");
    return context.json({ status: "ok", database: "ok" });
  });

  registerAdminRoutes(app, db, config);
  registerPublicRoutes(app, db, config);

  app.notFound((context) => context.text("Not found", 404));
  app.onError((error, context) => {
    console.error(error);
    return context.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500);
  });

  return { app, db, config, close: () => db.close() };
}
