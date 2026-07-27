import type { Hono } from "hono";
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from "jose";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { Layout } from "./layout.js";
import { issueCsrf, text, validCsrf } from "./security.js";
import { getStoreObject, responseStore } from "./s3.js";

type Admin = { id: number; email: string; role: "admin" | "moderator" };
const responseStatuses = ["new", "under_review", "confirmed", "insufficient_data", "duplicate", "rejected"];

export function registerAdminRoutes(app: Hono, db: Db, config: Config) {
  app.use("/admin", protect);
  app.use("/admin/*", protect);

  async function protect(context: any, next: () => Promise<void>) {
    const email = await accessEmail(context, config);
    if (!email) return context.text("Forbidden", 403);
    if (config.adminEmails.includes(email)) db.prepare("INSERT INTO admins (email, role) VALUES (?, 'admin') ON CONFLICT(email) DO NOTHING").run(email);
    const admin = db.prepare("SELECT id, email, role FROM admins WHERE email = ? AND is_active = 1").get(email) as Admin | undefined;
    if (!admin) return context.text("Forbidden", 403);
    context.set("admin", admin);
    await next();
  }

  app.get("/admin", (context) => {
    const stats = db.prepare(`SELECT
      (SELECT count(*) FROM supporters WHERE email_verified_at IS NOT NULL AND deleted_at IS NULL) supporters,
      (SELECT count(*) FROM generated_requests) generated,
      (SELECT count(*) FROM request_actions WHERE action_type = 'reported_sent') sent,
      (SELECT count(*) FROM submitted_responses) responses`).get()!;
    return adminPage(context, "Dashboard", <><h1>Dashboard</h1><pre>{JSON.stringify(stats, null, 2)}</pre>{adminNav()}</>);
  });

  app.get("/admin/demands", (context) => {
    const rows = db.prepare(`SELECT d.id, d.sort_order, d.is_active, dt.locale, dt.title, dt.body FROM demands d
      LEFT JOIN demand_translations dt ON dt.demand_id = d.id ORDER BY d.sort_order, dt.locale`).all();
    return adminPage(context, "Demands", <><h1>Demands</h1><pre>{JSON.stringify(rows, null, 2)}</pre>{demandForm(issueCsrf(context, config))}</>);
  });

  app.post("/admin/demands", async (context) => {
    const body = await context.req.parseBody();
    if (!validCsrf(context, config, body)) return context.text("Forbidden", 403);
    const action = text(body.action);
    const id = positiveInteger(body.id);
    mutate(db, currentAdmin(context), action, "demand", body, () => {
      if (action === "delete" && id) return void db.prepare("DELETE FROM demands WHERE id = ?").run(id);
      if (action !== "save" || !["he", "ar", "yi", "ru", "en", "am"].includes(text(body.locale)) || !text(body.title) || !text(body.body)) throw new Error("Invalid demand");
      const demandId = id ?? Number((db.prepare("INSERT INTO demands (campaign_id, sort_order, is_active) VALUES (1, ?, ?) RETURNING id").get(number(body.sortOrder, 1), text(body.isActive) === "yes" ? 1 : 0) as { id: number }).id);
      if (id) db.prepare("UPDATE demands SET sort_order = ?, is_active = ? WHERE id = ?").run(number(body.sortOrder, 1), text(body.isActive) === "yes" ? 1 : 0, id);
      db.prepare(`INSERT INTO demand_translations (demand_id, locale, title, body) VALUES (?, ?, ?, ?)
        ON CONFLICT(demand_id, locale) DO UPDATE SET title = excluded.title, body = excluded.body`).run(demandId, text(body.locale), text(body.title), text(body.body));
    });
    return context.redirect("/admin/demands", 303);
  });

  app.get("/admin/recipients", (context) => {
    const rows = db.prepare(`SELECT r.*, rt.locale, rt.name FROM recipients r LEFT JOIN recipient_translations rt ON rt.recipient_id = r.id ORDER BY r.id, rt.locale`).all();
    const csrf = issueCsrf(context, config);
    return adminPage(context, "Recipients", <><h1>Recipients</h1><pre>{JSON.stringify(rows, null, 2)}</pre><form method="post">
      <input type="hidden" name="csrf" value={csrf} /><input name="id" type="number" placeholder="ID to update/delete" />
      <label>Action<select name="action"><option value="save">Save</option><option value="delete">Delete</option></select></label>
      <label>Type<select name="type"><option>party</option><option>politician</option></select></label><label>Locale<input name="locale" value="en" /></label>
      <label>Name<input name="name" /></label><label>Email<input name="email" type="email" /></label><label>WhatsApp<input name="whatsapp" /></label><label>Website<input name="website" type="url" /></label>
      <label>Social handle<input name="socialHandle" placeholder="@handle — blank falls back to the localized name" /></label>
      <label><input name="isActive" type="checkbox" value="yes" checked /> Active</label><button>Apply</button></form></>);
  });

  app.post("/admin/recipients", async (context) => {
    const body = await context.req.parseBody();
    if (!validCsrf(context, config, body)) return context.text("Forbidden", 403);
    const action = text(body.action); const id = positiveInteger(body.id);
    mutate(db, currentAdmin(context), action, "recipient", body, () => {
      if (action === "delete" && id) return void db.prepare("DELETE FROM recipients WHERE id = ?").run(id);
      if (action !== "save" || !["party", "politician"].includes(text(body.type)) || !["he", "ar", "yi", "ru", "en", "am"].includes(text(body.locale)) || !text(body.name)) throw new Error("Invalid recipient");
      const recipientId = id ?? Number((db.prepare("INSERT INTO recipients (type, email, whatsapp, website, social_handle, is_active) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
        .get(text(body.type), nullable(body.email), nullable(body.whatsapp), nullable(body.website), nullable(body.socialHandle), text(body.isActive) === "yes" ? 1 : 0) as { id: number }).id);
      if (id) db.prepare("UPDATE recipients SET type = ?, email = ?, whatsapp = ?, website = ?, social_handle = ?, is_active = ? WHERE id = ?").run(text(body.type), nullable(body.email), nullable(body.whatsapp), nullable(body.website), nullable(body.socialHandle), text(body.isActive) === "yes" ? 1 : 0, id);
      db.prepare(`INSERT INTO recipient_translations (recipient_id, locale, name) VALUES (?, ?, ?)
        ON CONFLICT(recipient_id, locale) DO UPDATE SET name = excluded.name`).run(recipientId, text(body.locale), text(body.name));
    });
    return context.redirect("/admin/recipients", 303);
  });

  app.get("/admin/templates", (context) => {
    const csrf = issueCsrf(context, config);
    return adminPage(context, "Templates", <><h1>Templates</h1><pre>{JSON.stringify(db.prepare("SELECT * FROM message_templates ORDER BY locale, channel").all(), null, 2)}</pre><form method="post">
      <input type="hidden" name="csrf" value={csrf} /><label>Action<select name="action"><option value="save">Save</option><option value="delete">Delete</option></select></label>
      <label>Locale<input name="locale" value="en" /></label><label>Channel<select name="channel"><option>email</option><option>whatsapp</option><option>social</option></select></label>
      <label>Subject<input name="subject" /></label><label>Body<textarea name="body" required></textarea></label><button>Apply</button></form></>);
  });

  app.post("/admin/templates", async (context) => {
    const body = await context.req.parseBody();
    if (!validCsrf(context, config, body)) return context.text("Forbidden", 403);
    mutate(db, currentAdmin(context), text(body.action), "template", body, () => {
      if (text(body.action) === "delete") return void db.prepare("DELETE FROM message_templates WHERE locale = ? AND channel = ?").run(text(body.locale), text(body.channel));
      if (!text(body.body) || !["he", "ar", "yi", "ru", "en", "am"].includes(text(body.locale)) || !["email", "whatsapp", "social"].includes(text(body.channel))) throw new Error("Invalid template");
      db.prepare(`INSERT INTO message_templates (locale, channel, subject, body) VALUES (?, ?, ?, ?)
        ON CONFLICT(locale, channel) DO UPDATE SET subject = excluded.subject, body = excluded.body`).run(text(body.locale), text(body.channel), nullable(body.subject), text(body.body));
    });
    return context.redirect("/admin/templates", 303);
  });

  app.get("/admin/supporters", (context) => adminPage(context, "Supporters", <><h1>Supporters</h1><p><a href="/admin/supporters.csv">Export CSV</a></p><pre>{JSON.stringify(db.prepare("SELECT id, email_normalized, name, city, locale, email_verified_at FROM supporters WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 200").all(), null, 2)}</pre></>));
  app.get("/admin/supporters.csv", (context) => csv(context, ["id", "email", "name", "city", "locale", "verified_at"], db.prepare("SELECT id, email_normalized email, name, city, locale, email_verified_at verified_at FROM supporters WHERE deleted_at IS NULL").all()));

  app.get("/admin/responses", (context) => adminPage(context, "Moderation", <><h1>Moderation queue</h1><ul>{(db.prepare("SELECT id, status, received_at, channel FROM submitted_responses ORDER BY created_at DESC").all() as any[]).map((row) => <li><a href={`/admin/responses/${row.id}`}>#{row.id}</a> — {row.status} — {row.channel}</li>)}</ul></>));
  app.get("/admin/responses/:id", (context) => {
    const row = db.prepare("SELECT * FROM submitted_responses WHERE id = ?").get(context.req.param("id"));
    if (!row) return context.notFound();
    const csrf = issueCsrf(context, config);
    const files = db.prepare("SELECT id, mime, size FROM submitted_response_files WHERE response_id = ?").all(context.req.param("id")) as { id: number; mime: string; size: number }[];
    return adminPage(context, "Review response", <><h1>Review response</h1><pre>{JSON.stringify(row, null, 2)}</pre><ul>{files.map((file) => <li><a href={`/admin/response-files/${file.id}`}>{file.mime} ({file.size} bytes)</a></li>)}</ul><form method="post"><input type="hidden" name="csrf" value={csrf} />
      <label>Status<select name="status">{responseStatuses.map((status) => <option value={status}>{status}</option>)}</select></label><button>Update</button></form></>);
  });
  app.get("/admin/response-files/:id", async (context) => {
    const file = db.prepare("SELECT object_key, mime FROM submitted_response_files WHERE id = ?").get(context.req.param("id")) as { object_key: string; mime: string } | undefined;
    if (!file) return context.notFound();
    try { const data = await getStoreObject(responseStore(config), file.object_key); context.header("Content-Type", file.mime); context.header("Cache-Control", "private, no-store"); return context.body(new Uint8Array(data)); }
    catch { return context.text("File storage unavailable", 503); }
  });
  app.post("/admin/responses/:id", async (context) => {
    const body = await context.req.parseBody(); const id = positiveInteger(context.req.param("id"));
    if (!validCsrf(context, config, body)) return context.text("Forbidden", 403);
    if (!id || !responseStatuses.includes(text(body.status))) return context.text("Invalid", 422);
    mutate(db, currentAdmin(context), "status", "response", { id, status: text(body.status) }, () => void db.prepare("UPDATE submitted_responses SET status = ?, reviewed_at = ? WHERE id = ?").run(text(body.status), new Date().toISOString(), id));
    return context.redirect(`/admin/responses/${id}`, 303);
  });

  app.get("/admin/audit", (context) => adminPage(context, "Audit", <><h1>Audit log</h1><pre>{JSON.stringify(db.prepare("SELECT * FROM admin_audit_events ORDER BY id DESC LIMIT 500").all(), null, 2)}</pre></>));
  app.get("/admin/settings", (context) => {
    const row = db.prepare("SELECT * FROM campaigns WHERE id = 1").get(); const csrf = issueCsrf(context, config);
    return adminPage(context, "Settings", <><h1>Kill switches</h1><pre>{JSON.stringify(row, null, 2)}</pre><form method="post"><input type="hidden" name="csrf" value={csrf} />
      <label><input type="checkbox" name="campaign" value="yes" checked /> Campaign active</label>
      <label><input type="checkbox" name="support" value="yes" checked /> Support</label><label><input type="checkbox" name="requests" value="yes" checked /> Requests</label><label><input type="checkbox" name="responses" value="yes" checked /> Responses</label><button>Save</button></form></>);
  });
  app.post("/admin/settings", async (context) => {
    const body = await context.req.parseBody(); if (!validCsrf(context, config, body)) return context.text("Forbidden", 403);
    mutate(db, currentAdmin(context), "update", "campaign_settings", body, () => void db.prepare("UPDATE campaigns SET status = ?, support_enabled = ?, requests_enabled = ?, responses_enabled = ? WHERE id = 1")
      .run(text(body.campaign) === "yes" ? "active" : "draft", text(body.support) === "yes" ? 1 : 0, text(body.requests) === "yes" ? 1 : 0, text(body.responses) === "yes" ? 1 : 0));
    return context.redirect("/admin/settings", 303);
  });
  app.get("/admin/export/stats", (context) => csv(context, ["metric", "value"], [
    { metric: "verified_supporters", value: db.prepare("SELECT count(*) count FROM supporters WHERE email_verified_at IS NOT NULL AND deleted_at IS NULL").get()?.count },
    ...db.prepare("SELECT action_type metric, count(*) value FROM request_actions GROUP BY action_type").all(),
    { metric: "submitted_responses", value: db.prepare("SELECT count(*) count FROM submitted_responses").get()?.count }
  ]));
}

async function accessEmail(context: any, config: Config) {
  if (config.nodeEnv === "test" && context.req.header("X-Test-Admin-Email")) return context.req.header("X-Test-Admin-Email");
  if (!config.accessTeamDomain || !config.accessAud) return undefined;
  const token = context.req.header("Cf-Access-Jwt-Assertion"); if (!token) return undefined;
  try {
    const issuer = config.accessTeamDomain.startsWith("http") ? config.accessTeamDomain.replace(/\/$/, "") : `https://${config.accessTeamDomain.replace(/\/$/, "")}`;
    const jwks = config.accessTestJwks ? createLocalJWKSet(JSON.parse(config.accessTestJwks)) : createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    const result = await jwtVerify(token, jwks, { issuer, audience: config.accessAud });
    return typeof result.payload.email === "string" ? result.payload.email.toLowerCase() : undefined;
  } catch { return undefined; }
}

function currentAdmin(context: any) { return context.get("admin") as Admin; }
function mutate(db: Db, admin: Admin, action: string, entity: string, payload: unknown, operation: () => void) {
  db.exec("BEGIN IMMEDIATE");
  try { operation(); db.prepare("INSERT INTO admin_audit_events (admin_id, action, entity, payload, created_at) VALUES (?, ?, ?, ?, ?)").run(admin.id, action, entity, JSON.stringify(withoutSecrets(payload)), new Date().toISOString()); db.exec("COMMIT"); }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
function adminPage(context: any, title: string, content: any) { context.header("Cache-Control", "private, no-store"); return context.html(<Layout locale="en" title={title} path="/en">{adminNav()}{content}</Layout>); }
function adminNav() { return <nav aria-label="Admin"><a href="/admin">Dashboard</a> · <a href="/admin/demands">Demands</a> · <a href="/admin/recipients">Recipients</a> · <a href="/admin/templates">Templates</a> · <a href="/admin/supporters">Supporters</a> · <a href="/admin/responses">Responses</a> · <a href="/admin/audit">Audit</a> · <a href="/admin/settings">Settings</a></nav>; }
function demandForm(csrf: string) { return <form method="post"><input type="hidden" name="csrf" value={csrf} /><input name="id" type="number" placeholder="ID to update/delete" /><label>Action<select name="action"><option value="save">Save</option><option value="delete">Delete</option></select></label><label>Order<input name="sortOrder" type="number" value="1" /></label><label><input name="isActive" type="checkbox" value="yes" checked /> Active</label><label>Locale<input name="locale" value="en" /></label><label>Title<input name="title" /></label><label>Markdown body<textarea name="body"></textarea></label><button>Apply</button></form>; }
function positiveInteger(value: unknown) { const result = Number(text(value)); return Number.isInteger(result) && result > 0 ? result : undefined; }
function number(value: unknown, fallback: number) { const result = Number(text(value)); return Number.isFinite(result) ? result : fallback; }
function nullable(value: unknown) { return text(value) || null; }
function csv(context: any, headers: string[], rows: any[]) { context.header("Content-Type", "text/csv; charset=utf-8"); context.header("Content-Disposition", "attachment"); return context.body([headers, ...rows.map((row) => headers.map((header) => row[header]))].map((row) => row.map(csvCell).join(",")).join("\n")); }
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function withoutSecrets(payload: unknown) { if (!payload || typeof payload !== "object") return payload; return Object.fromEntries(Object.entries(payload).filter(([key]) => !["csrf", "cf-turnstile-response"].includes(key))); }
