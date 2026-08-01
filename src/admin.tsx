import type { Hono } from "hono";
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from "jose";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { isLocale, locales, t } from "./i18n.js";
import { AppearanceSwitcher, Shell } from "./layout.js";
import { issueCsrf, text, validCsrf } from "./security.js";
import { getStoreObject, responseStore } from "./s3.js";

type Admin = { id: number; email: string; role: "admin" | "moderator" };
type Row = Record<string, unknown>;

const responseStatuses = ["new", "under_review", "confirmed", "insufficient_data", "duplicate", "rejected"];
const openStatuses = ["new", "under_review"];
const channels = ["email", "whatsapp", "social"];
/** Every nav entry an admin has; `moderator` marks the two a moderator may also reach. */
const navigation = [
  { href: "/admin", label: "Dashboard", moderator: true },
  { href: "/admin/responses", label: "Moderation", moderator: true },
  { href: "/admin/demands", label: "Demands", moderator: false },
  { href: "/admin/recipients", label: "Recipients", moderator: false },
  { href: "/admin/templates", label: "Templates", moderator: false },
  { href: "/admin/supporters", label: "Supporters", moderator: false },
  { href: "/admin/audit", label: "Audit", moderator: false },
  { href: "/admin/settings", label: "Settings", moderator: false }
];

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
    const moderator = currentAdmin(context).role === "moderator";
    const queue = db.prepare(`SELECT count(*) count FROM submitted_responses WHERE status IN ('new', 'under_review')`).get() as Row;
    const stats = moderator
      ? db.prepare("SELECT count(*) responses FROM submitted_responses").get() as Row
      : db.prepare(`SELECT
        (SELECT count(*) FROM supporters WHERE email_verified_at IS NOT NULL AND deleted_at IS NULL) supporters,
        (SELECT count(*) FROM generated_requests) generated,
        (SELECT count(*) FROM request_actions WHERE action_type = 'reported_sent') sent,
        (SELECT count(*) FROM submitted_responses) responses`).get() as Row;
    const pending = count(queue.count);
    return adminPage(context, "Dashboard", <>
      <h1>Dashboard</h1>
      <p class="lede">Campaign totals as of this page load. Counts are aggregates only — no appeal text is stored.</p>
      <ul class="metrics">
        {moderator ? null : <>
          {metric(stats.supporters, "Verified supporters")}
          {metric(stats.generated, "Requests generated")}
          {metric(stats.sent, "Reported sent")}
        </>}
        {metric(stats.responses, "Responses received")}
        {metric(pending, "Awaiting review")}
      </ul>
      {/* The queue is the only part of this page that asks for an action, so it is the only
          part styled as one. */}
      <p class="admin-callout" role="status">
        {pending ? <>{pending} response{pending === 1 ? "" : "s"} {pending === 1 ? "is" : "are"} waiting on a decision. </> : <>The moderation queue is clear. </>}
        <a href="/admin/responses?status=new">Open the queue</a>
      </p>
      {moderator ? null : <>
        <h2 class="section-label">Exports</h2>
        <p class="admin-links"><a href="/admin/export/stats">Aggregate statistics (CSV)</a> <a href="/admin/supporters.csv">Supporter list (CSV)</a></p>
      </>}
    </>);
  });

  app.get("/admin/demands", (context) => {
    const rows = db.prepare(`SELECT d.id, d.sort_order, d.is_active, d.document,
      (SELECT title FROM demand_translations WHERE demand_id = d.id ORDER BY locale = 'en' DESC, locale LIMIT 1) title,
      (SELECT group_concat(locale) FROM demand_translations WHERE demand_id = d.id) translated
      FROM demands d ORDER BY d.document, d.sort_order, d.id`).all() as Row[];
    const csrf = issueCsrf(context, config);
    return adminPage(context, "Demands", <>
      <h1>Demands</h1>
      <p class="lede">Clauses of the Standard and the Coalition Agreement. A demand is only visible to the public in the languages it has been translated into.</p>
      {rows.length ? <div class="admin-table"><table>
        <thead><tr><th scope="col">#</th><th scope="col">Order</th><th scope="col">Document</th><th scope="col">State</th><th scope="col">Title</th><th scope="col">Translations</th><th scope="col">Delete</th></tr></thead>
        <tbody>{rows.map((row) => <tr>
          <td class="admin-num">{count(row.id)}</td>
          <td class="admin-num">{count(row.sort_order)}</td>
          <td><span class="badge">{String(row.document)}</span></td>
          <td>{activeBadge(row.is_active)}</td>
          {/* Six scripts share these tables; dir=auto lets each cell take the direction of the
              text it actually holds instead of forcing Hebrew and Arabic into an LTR box. */}
          <td dir="auto">{row.title ? String(row.title) : <span class="admin-nil">untranslated</span>}</td>
          <td>{localeChips(String(row.translated ?? ""), (locale) => `/admin/demands/edit?id=${count(row.id)}&locale=${locale}`)}</td>
          <td>{deleteForm(csrf, { id: String(count(row.id)) }, `Delete demand #${count(row.id)} and every translation of it? This cannot be undone.`)}</td>
        </tr>)}</tbody>
      </table></div> : <p class="admin-nil" role="status">No demands yet.</p>}
      <h2 class="section-label" id="new">Add a demand</h2>
      <p class="note">Saving a locale that already exists overwrites that translation. Leave the ID blank to create a new demand.</p>
      {demandForm(csrf)}
    </>);
  });

  app.get("/admin/demands/edit", (context) => {
    const id = positiveInteger(context.req.query("id")); const locale = text(context.req.query("locale"));
    if (!id || !isLocale(locale)) return context.notFound();
    const row = db.prepare(`SELECT d.id, d.sort_order, d.is_active, d.document, dt.locale, dt.title, dt.body, dt.rationale, dt.verification, dt.exceptions
      FROM demands d LEFT JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = ? WHERE d.id = ?`).get(locale, id) as Row | undefined;
    if (!row) return context.notFound();
    return adminPage(context, "Edit demand", <>
      <p class="admin-back"><a href="/admin/demands">← All demands</a></p>
      <h1>Edit demand #{id}</h1>
      <p class="lede">{row.title ? <>Editing the <b>{locale}</b> translation.</> : <>No <b>{locale}</b> translation exists yet — saving creates it.</>}</p>
      {demandForm(issueCsrf(context, config), { ...row, locale })}
    </>);
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
    const valid = action === "delete" && id || action === "save" && ["standard", "coalition"].includes(document) && isLocale(text(body.locale)) && Boolean(title) && Boolean(commitment);
    if (!valid) return adminPage(context, "Demands", <><h1>Demands</h1><p class="admin-error" role="alert">Enter a document, locale, title, and body before saving.</p>{demandForm(issueCsrf(context, config), body)}</> , 422);
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
    const rows = db.prepare(`SELECT r.id, r.type, r.email, r.whatsapp, r.website, r.social_handle, r.is_active,
      (SELECT name FROM recipient_translations WHERE recipient_id = r.id ORDER BY locale = 'en' DESC, locale LIMIT 1) name,
      (SELECT group_concat(locale) FROM recipient_translations WHERE recipient_id = r.id) translated
      FROM recipients r ORDER BY r.type, r.id`).all() as Row[];
    const csrf = issueCsrf(context, config);
    const editing = recipientPrefill(db, context.req.query("id"), context.req.query("locale"));
    return adminPage(context, "Recipients", <>
      <h1>Recipients</h1>
      <p class="lede">Parties and politicians a supporter can address. A recipient with no channel — no email, WhatsApp, website or handle — cannot be written to.</p>
      {rows.length ? <div class="admin-table"><table>
        <thead><tr><th scope="col">#</th><th scope="col">Type</th><th scope="col">Name</th><th scope="col">Channels</th><th scope="col">State</th><th scope="col">Names by locale</th><th scope="col">Delete</th></tr></thead>
        <tbody>{rows.map((row) => <tr>
          <td class="admin-num">{count(row.id)}</td>
          <td><span class="badge">{String(row.type)}</span></td>
          <td dir="auto">{row.name ? String(row.name) : <span class="admin-nil">unnamed</span>}</td>
          <td>{channelBadges(row)}</td>
          <td>{activeBadge(row.is_active)}</td>
          <td>{localeChips(String(row.translated ?? ""), (locale) => `/admin/recipients?id=${count(row.id)}&locale=${locale}#edit`)}</td>
          <td>{deleteForm(csrf, { id: String(count(row.id)) }, `Delete recipient #${count(row.id)} and every translation of it? This cannot be undone.`)}</td>
        </tr>)}</tbody>
      </table></div> : <p class="admin-nil" role="status">No recipients yet.</p>}
      <h2 class="section-label" id="edit">{editing ? `Edit recipient #${editing.id}` : "Add a recipient"}</h2>
      <p class="note">Saving a locale that already exists overwrites that name. Leave the ID blank to create a new recipient.</p>
      {recipientForm(csrf, editing?.values ?? {})}
    </>);
  });

  app.post("/admin/recipients", async (context) => {
    const body = await context.req.parseBody();
    if (!validCsrf(context, config, body)) return context.text("Forbidden", 403);
    const action = text(body.action); const id = positiveInteger(body.id);
    if (!(action === "delete" && id) && !(action === "save" && ["party", "politician"].includes(text(body.type)) && isLocale(text(body.locale)) && text(body.name))) {
      return adminPage(context, "Recipients", <><h1>Recipients</h1><p class="admin-error" role="alert">Choose a valid type and locale, and enter a name.</p>{recipientForm(issueCsrf(context, config), body)}</>, 422);
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
    const rows = db.prepare("SELECT locale, channel, subject, body FROM message_templates ORDER BY locale, channel").all() as Row[];
    const csrf = issueCsrf(context, config);
    const editing = rows.find((row) => row.locale === text(context.req.query("locale")) && row.channel === text(context.req.query("channel")));
    const missing = locales.flatMap((locale) => channels.filter((channel) => !rows.some((row) => row.locale === locale && row.channel === channel)).map((channel) => ({ locale, channel })));
    return adminPage(context, "Templates", <>
      <h1>Templates</h1>
      <p class="lede">The message a supporter starts from, per locale and channel. A missing template means that channel silently offers nothing in that language.</p>
      {rows.length ? <div class="admin-table"><table>
        <thead><tr><th scope="col">Locale</th><th scope="col">Channel</th><th scope="col">Subject</th><th scope="col">Body</th><th scope="col">Edit</th><th scope="col">Delete</th></tr></thead>
        <tbody>{rows.map((row) => <tr>
          <td class="admin-num">{String(row.locale)}</td>
          <td><span class="badge">{String(row.channel)}</span></td>
          <td dir="auto">{cell(row.subject)}</td>
          <td dir="auto"><span class="admin-excerpt">{cell(row.body)}</span></td>
          <td><a href={`/admin/templates?locale=${row.locale}&channel=${row.channel}#edit`}>Edit</a></td>
          <td>{deleteForm(csrf, { locale: String(row.locale), channel: String(row.channel) }, `Delete the ${row.locale}/${row.channel} template? This cannot be undone.`)}</td>
        </tr>)}</tbody>
      </table></div> : <p class="admin-nil" role="status">No templates yet.</p>}
      {missing.length ? <p class="admin-callout" role="status">Missing: {missing.map(({ locale, channel }) => <a class="badge" href={`/admin/templates?locale=${locale}&channel=${channel}#edit`}>{locale}/{channel}</a>)}</p> : null}
      <h2 class="section-label" id="edit">{editing ? `Edit the ${editing.locale}/${editing.channel} template` : "Add a template"}</h2>
      <p class="note">Locale and channel together identify a template; saving an existing pair overwrites it.</p>
      {templateForm(csrf, editing ?? { locale: text(context.req.query("locale")), channel: text(context.req.query("channel")) })}
    </>);
  });

  app.post("/admin/templates", async (context) => {
    const body = await context.req.parseBody();
    if (!validCsrf(context, config, body)) return context.text("Forbidden", 403);
    const action = text(body.action);
    const valid = isLocale(text(body.locale)) && channels.includes(text(body.channel)) && (action === "delete" || Boolean(text(body.body)));
    // Validate before opening the transaction: a throw inside `mutate` would roll back and then
    // surface to the operator as a 500 JSON body instead of the form they were filling in.
    if (!valid) return adminPage(context, "Templates", <><h1>Templates</h1><p class="admin-error" role="alert">Choose a valid locale and channel, and enter a body before saving.</p>{templateForm(issueCsrf(context, config), body)}</>, 422);
    mutate(db, currentAdmin(context), action, "template", body, () => {
      if (action === "delete") return void db.prepare("DELETE FROM message_templates WHERE locale = ? AND channel = ?").run(text(body.locale), text(body.channel));
      db.prepare(`INSERT INTO message_templates (locale, channel, subject, body) VALUES (?, ?, ?, ?)
        ON CONFLICT(locale, channel) DO UPDATE SET subject = excluded.subject, body = excluded.body`).run(text(body.locale), text(body.channel), nullable(body.subject), text(body.body));
    });
    return context.redirect("/admin/templates", 303);
  });

  app.get("/admin/supporters", (context) => {
    const rows = db.prepare("SELECT id, email_normalized, name, city, locale, email_verified_at FROM supporters WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 200").all() as Row[];
    const total = count((db.prepare("SELECT count(*) count FROM supporters WHERE deleted_at IS NULL").get() as Row).count);
    return adminPage(context, "Supporters", <>
      <h1>Supporters</h1>
      <p class="lede">{total} on record{total > rows.length ? <>, most recent {rows.length} shown. The export contains all of them.</> : "."}</p>
      <p class="admin-links"><a href="/admin/supporters.csv">Export CSV</a></p>
      {dataTable(rows, "No supporters yet.")}
    </>);
  });
  app.get("/admin/supporters.csv", (context) => csv(context, ["id", "email", "name", "city", "locale", "verified_at"], db.prepare("SELECT id, email_normalized email, name, city, locale, email_verified_at verified_at FROM supporters WHERE deleted_at IS NULL").all()));

  app.get("/admin/responses", (context) => {
    const filter = responseStatuses.includes(text(context.req.query("status"))) ? text(context.req.query("status")) : "";
    const counts = new Map((db.prepare("SELECT status, count(*) count FROM submitted_responses GROUP BY status").all() as Row[]).map((row) => [String(row.status), count(row.count)]));
    const rows = (filter
      ? db.prepare("SELECT id, status, received_at, channel, recipient_id, created_at FROM submitted_responses WHERE status = ? ORDER BY created_at DESC").all(filter)
      : db.prepare("SELECT id, status, received_at, channel, recipient_id, created_at FROM submitted_responses ORDER BY created_at DESC").all()) as Row[];
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    return adminPage(context, "Moderation", <>
      <h1>Moderation queue</h1>
      <p class="lede">Replies supporters received and submitted back. Nothing here is public until it is reviewed.</p>
      {/* Statuses are listed in workflow order and always all of them, so a zero reads as
          "none in this state" rather than as a missing filter. */}
      <nav class="admin-filters" aria-label="Filter by status">
        <a href="/admin/responses" aria-current={filter ? undefined : "true"}>All <b>{total}</b></a>
        {responseStatuses.map((status) => <a href={`/admin/responses?status=${status}`} aria-current={filter === status ? "true" : undefined}>
          {statusLabel(status)} <b>{counts.get(status) ?? 0}</b>
        </a>)}
      </nav>
      {rows.length ? <div class="admin-table"><table>
        <thead><tr><th scope="col">#</th><th scope="col">Status</th><th scope="col">Received</th><th scope="col">Channel</th><th scope="col">Recipient</th><th scope="col">Submitted</th><th scope="col">Review</th></tr></thead>
        <tbody>{rows.map((row) => <tr>
          <td class="admin-num">{count(row.id)}</td>
          <td>{statusBadge(String(row.status))}</td>
          <td class="admin-num">{cell(row.received_at)}</td>
          <td><span class="badge">{String(row.channel)}</span></td>
          <td class="admin-num">{cell(row.recipient_id)}</td>
          <td>{cell(row.created_at)}</td>
          <td><a href={`/admin/responses/${count(row.id)}`}>Review</a></td>
        </tr>)}</tbody>
      </table></div> : <p class="admin-nil" role="status">{filter ? `Nothing with the status "${statusLabel(filter)}".` : "No responses submitted yet."}</p>}
    </>);
  });
  app.get("/admin/responses/:id", (context) => {
    const row = db.prepare("SELECT * FROM submitted_responses WHERE id = ?").get(context.req.param("id")) as Row | undefined;
    if (!row) return context.notFound();
    const csrf = issueCsrf(context, config);
    const files = db.prepare("SELECT id, mime, size FROM submitted_response_files WHERE response_id = ?").all(context.req.param("id")) as { id: number; mime: string; size: number }[];
    const { response_text: responseText, ...fields } = row;
    return adminPage(context, "Review response", <>
      <p class="admin-back"><a href="/admin/responses">← Moderation queue</a></p>
      <h1>Response #{count(row.id)} {statusBadge(String(row.status))}</h1>
      <h2 class="section-label">What was received</h2>
      <blockquote class="admin-quote" dir="auto">{responseText ? String(responseText) : <span class="admin-nil">No text submitted.</span>}</blockquote>
      <h2 class="section-label">Attachments</h2>
      {files.length
        ? <ul class="admin-files">{files.map((file) => <li><a href={`/admin/response-files/${file.id}`}>{file.mime}</a> <span class="admin-nil">{fileSize(file.size)}</span></li>)}</ul>
        : <p class="admin-nil">None.</p>}
      <h2 class="section-label">Submission details</h2>
      <dl class="admin-fields">{Object.entries(fields).map(([key, value]) => <><dt>{label(key)}</dt><dd>{cell(value)}</dd></>)}</dl>
      <h2 class="section-label">Decision</h2>
      <form method="post" class="admin-form">
        <input type="hidden" name="csrf" value={csrf} />
        {/* Pre-selected to the status it already has: an unrelated edit must not silently
            reset a confirmed response back to "new". */}
        <label class="full">Status<select name="status">{responseStatuses.map((status) => <option value={status} selected={status === row.status}>{statusLabel(status)}</option>)}</select></label>
        <p class="full"><button>Update status</button></p>
      </form>
    </>);
  });
  app.get("/admin/response-files/:id", async (context) => {
    const file = db.prepare("SELECT object_key, mime FROM submitted_response_files WHERE id = ?").get(context.req.param("id")) as { object_key: string; mime: string } | undefined;
    if (!file) return context.notFound();
    try { const data = await getStoreObject(responseStore(config), file.object_key); const downloadId = positiveInteger(context.req.param("id")) ?? 0; (context as any).set("downloadResponseFile", true); context.header("Content-Disposition", `attachment; filename="response-attachment-${downloadId}.bin"`); context.header("Content-Type", "application/octet-stream"); context.header("X-Content-Type-Options", "nosniff"); context.header("Content-Security-Policy", "default-src 'none'; sandbox"); context.header("Cache-Control", "private, no-store"); return context.body(new Uint8Array(data)); }
    catch { return context.text("File storage unavailable", 503); }
  });
  app.post("/admin/responses/:id", async (context) => {
    const body = await context.req.parseBody(); const id = positiveInteger(context.req.param("id"));
    if (!validCsrf(context, config, body)) return context.text("Forbidden", 403);
    if (!id || !responseStatuses.includes(text(body.status))) return context.text("Invalid", 422);
    mutate(db, currentAdmin(context), "status", "response", { id, status: text(body.status) }, () => void db.prepare("UPDATE submitted_responses SET status = ?, reviewed_at = ? WHERE id = ?").run(text(body.status), new Date().toISOString(), id));
    return context.redirect(`/admin/responses/${id}`, 303);
  });

  app.get("/admin/audit", (context) => {
    const rows = db.prepare(`SELECT e.id, a.email admin, e.action, e.entity, e.created_at, e.payload
      FROM admin_audit_events e LEFT JOIN admins a ON a.id = e.admin_id ORDER BY e.id DESC LIMIT 500`).all() as Row[];
    return adminPage(context, "Audit", <>
      <h1>Audit log</h1>
      <p class="lede">Every mutation an administrator made, newest first, most recent 500. Payloads are recorded with the CSRF and captcha fields stripped.</p>
      {rows.length ? <div class="admin-table"><table>
        <thead><tr><th scope="col">#</th><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Entity</th><th scope="col">Payload</th></tr></thead>
        <tbody>{rows.map((row) => <tr>
          <td class="admin-num">{count(row.id)}</td>
          <td>{cell(row.created_at)}</td>
          <td>{cell(row.admin)}</td>
          <td><span class="badge">{String(row.action)}</span></td>
          <td>{cell(row.entity)}</td>
          <td><details class="admin-payload"><summary>View</summary><pre>{prettyJson(row.payload)}</pre></details></td>
        </tr>)}</tbody>
      </table></div> : <p class="admin-nil" role="status">No administrator actions recorded yet.</p>}
    </>);
  });
  app.get("/admin/settings", (context) => {
    const row = db.prepare("SELECT * FROM campaigns WHERE id = 1").get() as Row | undefined;
    const csrf = issueCsrf(context, config);
    const live = row?.status === "active";
    return adminPage(context, "Settings", <>
      <h1>Kill switches</h1>
      <p class="lede">Each switch turns a public surface off immediately for everyone. Nothing is deleted; the pages report that the action is unavailable.</p>
      <p class="admin-callout" role="status">The campaign is currently {live ? <b>live</b> : <b>a draft, invisible to the public</b>}.</p>
      <form method="post" class="admin-switches">
        <input type="hidden" name="csrf" value={csrf} />
        {switchRow("campaign", "Campaign", "Off puts the whole site into draft: demands stop being served.", live)}
        {switchRow("support", "Support form", "Off stops new supporters from signing.", row?.support_enabled === 1)}
        {switchRow("requests", "Request builder", "Off stops supporters generating messages to recipients.", row?.requests_enabled === 1)}
        {switchRow("responses", "Response intake", "Off stops supporters submitting replies they received.", row?.responses_enabled === 1)}
        <p><button>Save switches</button></p>
      </form>
    </>);
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

/**
 * The console gets its own chrome rather than the public Layout: an operator needs the admin
 * sections, who they are signed in as, and a wide measure for tables — not the supporter's
 * numbered journey and language switcher.
 */
function adminPage(context: any, title: string, content: any, status = 200) {
  context.header("Cache-Control", "private, no-store");
  const admin = currentAdmin(context);
  return context.html(<Shell locale="en" title={title} bodyClass="admin">
    <a class="skip-link" href="#content">{t("en", "skip")}</a>
    <header class="wrap admin-bar">
      <a class="wordmark" href="/admin">{t("en", "siteName")} <span class="badge">Admin</span></a>
      <span class="admin-who"><bdi>{admin.email}</bdi> <span class="badge">{admin.role}</span></span>
      {adminNav(admin, String(context.req.path))}
    </header>
    <main id="content" class="wrap">{content}</main>
    <footer class="wrap admin-foot">
      <a href="/en">Public site ↗</a>
      <AppearanceSwitcher locale="en" />
    </footer>
  </Shell>, status);
}
function adminNav(admin: Admin, path: string) {
  const visible = navigation.filter((item) => admin.role === "admin" || item.moderator);
  return <nav class="admin-nav" aria-label="Admin">{visible.map((item) => <a href={item.href}
    aria-current={(item.href === "/admin" ? path === "/admin" : path.startsWith(item.href)) ? "page" : undefined}>{item.label}</a>)}</nav>;
}

/** One table for every plain listing: headers from the first row's keys, cells formatted by type. */
function dataTable(rows: Row[], empty: string) {
  if (!rows.length) return <p class="admin-nil" role="status">{empty}</p>;
  const columns = Object.keys(rows[0]!);
  return <div class="admin-table"><table>
    <thead><tr>{columns.map((column) => <th scope="col">{label(column)}</th>)}</tr></thead>
    <tbody>{rows.map((row) => <tr>{columns.map((column) => <td dir="auto" class={numeric(row[column]) ? "admin-num" : undefined}>{cell(row[column])}</td>)}</tr>)}</tbody>
  </table></div>;
}

/** Empty is a fact worth showing, and a timestamp is only scannable once the T is gone. */
function cell(value: unknown) {
  if (value === null || value === undefined || value === "") return <span class="admin-nil">—</span>;
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)) return <time datetime={value} class="admin-num">{value.slice(0, 16).replace("T", " ")}</time>;
  return String(value);
}
function numeric(value: unknown) { return typeof value === "number" || (typeof value === "string" && /^\d{4}-\d\d-\d\d/.test(value)); }
function label(key: string) { return key.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()); }
function count(value: unknown) { return Number(value ?? 0); }
function metric(value: unknown, name: string) { return <li><strong>{count(value)}</strong><span>{name}</span></li>; }
function statusLabel(status: string) { return label(status); }
function statusBadge(status: string) { return <span class={`badge ${openStatuses.includes(status) ? "on" : ""}`}>{statusLabel(status)}</span>; }
function activeBadge(value: unknown) { return <span class={`badge ${value ? "on" : "off"}`}>{value ? "Active" : "Inactive"}</span>; }
function channelBadges(row: Row) {
  const present = [["email", row.email], ["whatsapp", row.whatsapp], ["web", row.website], ["social", row.social_handle]].filter(([, value]) => value);
  return present.length ? <>{present.map(([name]) => <span class="badge">{String(name)}</span>)}</> : <span class="badge off">unreachable</span>;
}
/** Translation coverage at a glance: a solid chip exists, a dashed one is a gap to fill. */
function localeChips(present: string, href: (locale: string) => string) {
  const has = new Set(present.split(",").filter(Boolean));
  return <span class="locale-chips">{locales.map((locale) => <a href={href(locale)} class={has.has(locale) ? undefined : "missing"}
    title={has.has(locale) ? `Edit ${locale}` : `Add ${locale}`}>{locale}</a>)}</span>;
}
/** Its own form so deleting is never one mis-click inside the save form; `data-confirm` is read
    by the bundled script, since CSP forbids an inline onsubmit. */
function deleteForm(csrf: string, fields: Record<string, string>, confirmation: string) {
  return <form method="post" class="admin-delete" data-confirm={confirmation}>
    <input type="hidden" name="csrf" value={csrf} />
    <input type="hidden" name="action" value="delete" />
    {Object.entries(fields).map(([name, value]) => <input type="hidden" name={name} value={value} />)}
    <button class="danger">Delete</button>
  </form>;
}
function switchRow(name: string, title: string, description: string, on: boolean) {
  return <label class="admin-switch">
    <input type="checkbox" name={name} value="yes" checked={on} />
    <span><b>{title}</b><small>{description}</small></span>
  </label>;
}
function fileSize(size: number) { return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`; }
function prettyJson(value: unknown) { try { return JSON.stringify(JSON.parse(String(value)), null, 2); } catch { return String(value ?? ""); } }

function recipientPrefill(db: Db, id: unknown, locale: unknown) {
  const recipientId = positiveInteger(id); const wanted = text(locale);
  if (!recipientId || !isLocale(wanted)) return undefined;
  const row = db.prepare("SELECT id, type, email, whatsapp, website, social_handle, is_active FROM recipients WHERE id = ?").get(recipientId) as Row | undefined;
  if (!row) return undefined;
  const translation = db.prepare("SELECT name FROM recipient_translations WHERE recipient_id = ? AND locale = ?").get(recipientId, wanted) as Row | undefined;
  return { id: recipientId, values: {
    id: String(recipientId), type: String(row.type), locale: wanted, name: text(translation?.name),
    email: text(row.email), whatsapp: text(row.whatsapp), website: text(row.website),
    socialHandle: text(row.social_handle), isActive: row.is_active ? "yes" : "no"
  } };
}

function recipientForm(csrf: string, body: Record<string, unknown> = {}) { const value = (key: string) => text(body[key]); return <form method="post" class="admin-form">
  <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="action" value="save" />
  <label>ID<input name="id" type="number" placeholder="blank creates a new recipient" value={value("id")} /></label>
  <label>Type<select name="type"><option value="party" selected={value("type") === "party"}>Party</option><option value="politician" selected={value("type") === "politician"}>Politician</option></select></label>
  <label>Locale<select name="locale" required>{locales.map((locale) => <option value={locale} selected={value("locale") === locale}>{locale}</option>)}</select></label>
  <label>Name<input name="name" value={value("name")} required /></label><label>Email<input name="email" type="email" value={value("email")} /></label><label>WhatsApp<input name="whatsapp" value={value("whatsapp")} /></label><label>Website<input name="website" type="url" value={value("website")} /></label>
  <label>Social handle<input name="socialHandle" value={value("socialHandle")} placeholder="@handle — blank falls back to the localized name" /></label>
  <label class="full"><input name="isActive" type="checkbox" value="yes" checked={value("isActive") === "yes" || !Object.keys(body).length} /> Active</label><p class="full"><button>Save recipient</button></p></form>; }

function demandForm(csrf: string, source: Record<string, unknown> = {}) { const value = (key: string) => formValue(source[key]); const editing = Boolean(value("id")); return <form method="post" class="admin-form"><input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="action" value="save" /><label>ID<input name="id" type="number" placeholder="blank creates a new demand" value={value("id")} /></label><label>Document<select name="document"><option value="standard" selected={value("document") === "standard" || !value("document")}>Standard</option><option value="coalition" selected={value("document") === "coalition"}>Coalition</option></select></label><label>Order<input name="sortOrder" type="number" value={value("sort_order") || value("sortOrder") || "1"} /></label><label>Active state<select name="isActive"><option value="yes" selected={value("is_active") === "1" || value("isActive") === "yes" || !editing}>Active</option><option value="no" selected={value("is_active") === "0" || value("isActive") === "no"}>Inactive</option></select></label><label>Locale<select name="locale" required>{locales.map((locale) => <option value={locale} selected={value("locale") === locale || (!value("locale") && locale === "en")}>{locale}</option>)}</select></label><label>Title<input name="title" required value={value("title")} /></label><label class="full">Commitment / body<textarea name="body" required>{value("body")}</textarea></label><label class="full">Rationale<textarea name="rationale">{value("rationale")}</textarea></label><label class="full">Verification<textarea name="verification">{value("verification")}</textarea></label><label class="full">Exceptions<textarea name="exceptions">{value("exceptions")}</textarea></label><p class="full"><button>Save demand</button></p></form>; }

function templateForm(csrf: string, source: Record<string, unknown> = {}) { const value = (key: string) => text(source[key]); return <form method="post" class="admin-form">
  <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="action" value="save" />
  <label>Locale<select name="locale" required>{locales.map((locale) => <option value={locale} selected={value("locale") === locale}>{locale}</option>)}</select></label>
  <label>Channel<select name="channel" required>{channels.map((channel) => <option value={channel} selected={value("channel") === channel}>{channel}</option>)}</select></label>
  <label class="full">Subject<input name="subject" value={value("subject")} placeholder="email only" /></label>
  <label class="full">Body<textarea name="body" required>{value("body")}</textarea></label>
  <p class="full"><button>Save template</button></p></form>; }

function positiveInteger(value: unknown) { const result = Number(text(value)); return Number.isInteger(result) && result > 0 ? result : undefined; }
function number(value: unknown, fallback: number) { const result = Number(text(value)); return Number.isFinite(result) ? result : fallback; }
function nullable(value: unknown) { return text(value) || null; }
function formValue(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? String(value) : text(value); }
function has(body: Record<string, unknown>, key: string) { return Object.prototype.hasOwnProperty.call(body, key); }
function csv(context: any, headers: string[], rows: any[]) { context.header("Content-Type", "text/csv; charset=utf-8"); context.header("Content-Disposition", "attachment"); return context.body([headers, ...rows.map((row) => headers.map((header) => row[header]))].map((row) => row.map(csvCell).join(",")).join("\n")); }
function csvCell(value: unknown) { const string = String(value ?? ""); const safe = /^[=+\-@\t\r]/.test(string) ? `'${string}` : string; return `"${safe.replaceAll('"', '""')}"`; }
const auditKeys = new Set(["id", "locale", "channel", "action", "document", "sortOrder", "isActive", "type", "status", "campaign", "support", "requests", "responses"]);
function withoutSecrets(payload: unknown) { if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {}; return Object.fromEntries(Object.entries(payload).filter(([key, value]) => auditKeys.has(key) && typeof value !== "object" && String(value).length <= 120)); }

function moderatorPath(path: string) {
  return /^\/admin\/?$/.test(path) || /^\/admin\/responses\/?$/.test(path) || /^\/admin\/responses\/[^/]+\/?$/.test(path) || /^\/admin\/response-files\/[^/]+\/?$/.test(path);
}
