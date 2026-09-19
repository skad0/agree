import { Hono } from "hono";
import { createApp } from "../src/app.js";
import { registerRequestRoutes } from "../src/requests.js";
import { registerResponseRoutes } from "../src/responses.js";
import { registerSupportRoutes } from "../src/support.js";

/** Isolated component harness for retained historical storage/privacy code.
 * These routes are deliberately NOT exposed by the production application.
 * Public retirement contracts are tested separately in share-first.test.ts.
 */
export function createLegacyApp(options: Parameters<typeof createApp>[0] = {}) {
  const runtime = createApp(options);
  const app = new Hono();
  app.use("*", async (context,next) => { (context as any).set("config",runtime.config); await next(); });
  registerRequestRoutes(app,runtime.db,runtime.config);
  registerResponseRoutes(app,runtime.db,runtime.config);
  registerSupportRoutes(app,runtime.db,runtime.config);
  app.route("/",runtime.app);
  return {...runtime,app};
}
