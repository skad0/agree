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
    if (!(admin.role === "admin" || admin.role === "moderator") || (admin.role === "moderator" && !moderatorPath(context.req.path))) return context.text("Forbidden", 403);
    context.set("admin", admin);
    await next();
  }

  app.get("/admin", (context) => {
    const stats = currentAdmin(context).role === "moderator"
      ? db.prepare("SELECT count(*) responses FROM submitted_responses").get()!
      : db.prepare(`SELECT
        (SELECT count(*) FROM supporters WHERE email_verified_at IS NOT NULL AND deleted_at IS NULL) supporters,
        (SELECT count(*) FROM generated_requests) generated,
        (SELECT count(*) FROM request_actions WHERE action_type = 'reported_sent') sent,
        (SELECT count(*) FROM submitted_responses) responses`).get()!;
    return adminPage(context, "Dashboard", <><h1>Dashboard</h1><pre>{JSON.stringify(stats, null, 2)}</pre></>);
  });

  app.get("/admin/demands", (context) => {
    const rows = db.prepare(`SELECT d.id, d.sort_order, d.is_active, d.document, dt.locale, dt.title, dt.body, dt.rationale, dt.verification, dt.exceptions FROM demands d
      LEFT JOIN demand_translations dt ON dt.demand_id = d.id ORDER BY d.sort_order, dt.locale`).all();
    return adminPage(context, "Demands", <><h1>Demands</h1><pre>{JSON.stringify(rows, null, 2)}</pre><ul>{(rows as any[]).map((row) => row.locale ? <li><a href={`/admin/demands/edit?id=${row.id}&locale=${row.locale}`}>Edit #{row.id} ({row.locale})</a></li> : null)}</ul>{demandForm(issueCsrf(context, config))}</>);
  });

  app.get("/admin/demands/edit", (context) => {
    const id = positiveInteger(context.req.query("id")); const locale = text(context.req.query("locale"));
    if (!id || !["he", "ar", "yi", "ru", "en", "am"].includes(locale)) return context.notFound();
    const row = db.prepare(`SELECT d.id, d.sort_order, d.is_active, d.document, dt.locale, dt.title, dt.body, dt.rationale, dt.verification, dt.exceptions
      FROM demands d LEFT JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = ? WHERE d.id = ?`).get(locale, id);
    if (!row) return context.notFound();
    return adminPage(context, "Edit demand", <><h1>Edit demand #{id}</h1>{demandForm(issueCsrf(context, config), row as Record<string, unknown>)}</>);
  });

  app.post("/admin/demands", async (context) => {
    const body = await context.req.parseBody();
    if (!validCsrf(context, config, body)) return context.text("Forbidden", 403);
    const action = text(body.action);
    const id = positiveInteger(body.id);
    const existingDemand = id ? db.prepare("SELECT document, sort_order, is_active FROM demands WHERE id = ?").get(id) as { document: string; sort_order: number; is_active: number } | undefined : undefined;
    const existingTranslation = id && text(body.locale) ? db.prepare("SELECT title, body, rationale, verification, exceptions FROM demand_translations WHERE demand_id = ? AND locale = ?").get(id, text(body.locale)) as { title: string; body: string; rationale: string | null; verification: string | null; exceptions: string | null } | undefined : undefined;
    const document = has(body, "document") ? text(body.document) : existingDemand?.document || "standard";
    const title = has(body, "title") ? text(body.title) : existingTranslation?.title || "";
    const commitment = has(body, "body") ? text(body.body) : existingTranslation?.body || "";
    const valid = action === "delete" && id || action === "save" && ["standard", "coalition"].includes(document) && ["he", "ar", "yi", "ru", "am", "en"].includes(text(body.locale)) && Boolean(title) && Boolean(commitment);
    if (!valid) return adminPage(context, "Demands", <><h1>Demands</h1><p role="alert">Enter a document, locale, title, and body before saving.</p>{demandForm(issueCsrf(context, config), body)}</> , 422);
    mutate(db, currentAdmin(context), action, "demand", body, () => {
      if (action === "delete" && id) return void db.prepare("DELETE FROM demands WHERE id = ?").run(id);
      const sortOrder = has(body, "sortOrder") ? number(body.sortOrder, existingDemand?.sort_order ?? 1) : existingDemand?.sort_order ?? 1;
      const active = has(body, "isActive") ? text(body.isActive) === "yes" ? 1 : 0 : existingDemand?.is_active ?? 1;
      const demandId = id ?? Number((db.prepare("INSERT INTO demands (campaign_id, sort_order, is_active, document) VALUES (1, ?, ?, ?) RETURNING id").get(sortOrder, active, document) as { id: number }).id);
      if (id) db.prepare("UPDATE demands SET sort_order = ?, is_active = ?, document = ? WHERE id = ?").run(sortOrder, active, document, id);
      db.prepare(`INSERT INTO demand_translations (demand_id, locale, title, body, rationale, verification, exceptions) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(demand_id, locale) DO UPDATE SET title = excluded.title, body = excluded.body, rationale = excluded.rationale, verification = excluded.verification, exceptions = excluded.exceptions`).run(demandId, text(body.locale), title, commitment, has(body, "rationale") ? nullable(body.rationale) : existingTranslation?.rationale ?? null, has(body, "verification") ? nullable(body.verification) : existingTranslation?.verification ?? null, has(body, "exceptions") ? nullable(body.exceptions) : existingTranslation?.exceptions ?? null);
    });
    return context.redirect("/admin/demands", 303);
  });

  app.get("/admin/recipients", (context) => {
    const rows = db.prepare(`SELECT r.*, rt.locale, rt.name FROM recipients r LEFT JOIN recipient_translations rt ON rt.recipient_id = r.id ORDER BY r.id, rt.locale`).all();
    const csrf = issueCsrf(context, config);
    return adminPage(context, "Recipients", <><h1>Recipients</h1><pre>{JSON.stringify(rows, null, 2)}</pre>{recipientForm(csrf)}</>);
  });

  app.post("/admin/recipients", async (context) => {
    const body = await context.req.parseBody();
    if (!validCsrf(context, config, body)) return context.text("Forbidden", 403);
    const action = text(body.action); const id = positiveInteger(body.id);
    if (!(action === "delete" && id) && !(action === "save" && ["party", "politician"].includes(text(body.type)) && ["he", "ar", "yi", "ru", "en", "am"].includes(text(body.locale)) && text(body.name))) {
      return adminPage(context, "Recipients", <><h1>Recipients</h1><p role="alert">Choose a valid type and locale, and enter a name.</p>{recipientForm(issueCsrf(context, config), body)}</>, 422);
    }
    mutate(db, currentAdmin(context), action, "recipient", body, () => {
      if (action === "delete" && id) return void db.prepare("DELETE FROM recipients WHERE id = ?").run(id);
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
      <label><input type="checkbox" name="campaign" value="yes" checked={row?.status === "active"} /> Campaign active</label>
      <label><input type="checkbox" name="support" value="yes" checked={row?.support_enabled === 1} /> Support</label><label><input type="checkbox" name="requests" value="yes" checked={row?.requests_enabled === 1} /> Requests</label><label><input type="checkbox" name="responses" value="yes" checked={row?.responses_enabled === 1} /> Responses</label><button>Save</button></form></>);
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
function adminPage(context: any, title: string, content: any, status = 200) { context.header("Cache-Control", "private, no-store"); return context.html(<Layout locale="en" title={title} path="/en">{adminNav(context)}{content}</Layout>, status); }
function adminNav(context: any) {
  const admin = context.get("admin") as Admin;
  return <nav aria-label="Admin"><a href="/admin">Dashboard</a> · <a href="/admin/responses">Responses</a>{admin.role === "admin" ? <> · <a href="/admin/demands">Demands</a> · <a href="/admin/recipients">Recipients</a> · <a href="/admin/templates">Templates</a> · <a href="/admin/supporters">Supporters</a> · <a href="/admin/audit">Audit</a> · <a href="/admin/settings">Settings</a></> : null}</nav>;
}
function recipientForm(csrf: string, body: Record<string, unknown> = {}) { const value = (key: string) => text(body[key]); return <form method="post">
  <input type="hidden" name="csrf" value={csrf} /><input name="id" type="number" placeholder="ID to update/delete" value={value("id")} />
  <label>Action<select name="action"><option value="save">Save</option><option value="delete">Delete</option></select></label>
  <label>Type<select name="type"><option value="party" selected={value("type") === "party"}>Party</option><option value="politician" selected={value("type") === "politician"}>Politician</option></select></label>
  <label>Locale<select name="locale" required>{["he", "ar", "yi", "ru", "en", "am"].map((locale) => <option value={locale} selected={value("locale") === locale}>{locale}</option>)}</select></label>
  <label>Name<input name="name" value={value("name")} required /></label><label>Email<input name="email" type="email" value={value("email")} /></label><label>WhatsApp<input name="whatsapp" value={value("whatsapp")} /></label><label>Website<input name="website" type="url" value={value("website")} /></label>
  <label>Social handle<input name="socialHandle" value={value("socialHandle")} placeholder="@handle — blank falls back to the localized name" /></label>
  <label><input name="isActive" type="checkbox" value="yes" checked={value("isActive") === "yes" || !Object.keys(body).length} /> Active</label><button>Apply</button></form>; }
function demandForm(csrf: string, source: Record<string, unknown> = {}) { const value = (key: string) => formValue(source[key]); const editing = Boolean(value("id")); return <form method="post"><input type="hidden" name="csrf" value={csrf} /><input name="id" type="number" placeholder="ID to update/delete" value={value("id")} /><label>Action<select name="action"><option value="save">Save</option><option value="delete">Delete</option></select></label><label>Document<select name="document"><option value="standard" selected={value("document") === "standard" || !value("document")}>Standard</option><option value="coalition" selected={value("document") === "coalition"}>Coalition</option></select></label><label>Order<input name="sortOrder" type="number" value={value("sort_order") || value("sortOrder") || "1"} /></label><label>Active state<select name="isActive"><option value="yes" selected={value("is_active") === "1" || value("isActive") === "yes" || !editing}>Active</option><option value="no" selected={value("is_active") === "0" || value("isActive") === "no"}>Inactive</option></select></label><label>Locale<select name="locale" required>{["he", "ar", "yi", "ru", "en", "am"].map((locale) => <option value={locale} selected={value("locale") === locale || (!value("locale") && locale === "en")}>{locale}</option>)}</select></label><label>Title<input name="title" required value={value("title")} /></label><label>Commitment / body<textarea name="body" required>{value("body")}</textarea></label><label>Rationale<textarea name="rationale">{value("rationale")}</textarea></label><label>Verification<textarea name="verification">{value("verification")}</textarea></label><label>Exceptions<textarea name="exceptions">{value("exceptions")}</textarea></label><button>Apply</button></form>; }
function positiveInteger(value: unknown) { const result = Number(text(value)); return Number.isInteger(result) && result > 0 ? result : undefined; }
function number(value: unknown, fallback: number) { const result = Number(text(value)); return Number.isFinite(result) ? result : fallback; }
function nullable(value: unknown) { return text(value) || null; }
function formValue(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? String(value) : text(value); }
function has(body: Record<string, unknown>, key: string) { return Object.prototype.hasOwnProperty.call(body, key); }
function csv(context: any, headers: string[], rows: any[]) { context.header("Content-Type", "text/csv; charset=utf-8"); context.header("Content-Disposition", "attachment"); return context.body([headers, ...rows.map((row) => headers.map((header) => row[header]))].map((row) => row.map(csvCell).join(",")).join("\n")); }
function csvCell(value: unknown) { const string = String(value ?? ""); const safe = /^[=+\-@\t\r]/.test(string) ? `'${string}` : string; return `"${safe.replaceAll('"', '""')}"`; }
function withoutSecrets(payload: unknown) { if (!payload || typeof payload !== "object") return payload; return Object.fromEntries(Object.entries(payload).filter(([key]) => !["csrf", "cf-turnstile-response"].includes(key))); }

function moderatorPath(path: string) {
  return /^\/admin\/?$/.test(path) || /^\/admin\/responses\/?$/.test(path) || /^\/admin\/responses\/[^/]+\/?$/.test(path) || /^\/admin\/response-files\/[^/]+\/?$/.test(path);
}
