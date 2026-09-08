import type { Db } from "./db.js";
import type { Locale } from "./i18n.js";

export type RecipientType = "party" | "politician";

export type Recipient = {
  id: number;
  type: RecipientType;
  name: string;
  email: string | null;
  whatsapp: string | null;
  socialHandle: string | null;
};

export type ContactableRecipient = Recipient;

export type DirectoryBrowseItem = {
  id: number;
  name: string;
  type: RecipientType;
  contactable: boolean;
};

const namedRecipientSql = `SELECT r.id, r.type, rt.name, r.email, r.whatsapp, r.social_handle AS socialHandle FROM recipients r
    JOIN recipient_translations rt ON rt.recipient_id = r.id AND rt.locale = ?
    WHERE r.is_active = 1`;
const sendableChannelSql = `(NULLIF(TRIM(r.email), '') IS NOT NULL OR NULLIF(TRIM(r.whatsapp), '') IS NOT NULL)`;

export function listNamedRecipients(db: Db, locale: Locale): Recipient[] {
  return db.prepare(`${namedRecipientSql} ORDER BY rt.name`).all(locale) as Recipient[];
}

export function listContactableRecipients(db: Db, locale: Locale): ContactableRecipient[] {
  return db.prepare(`${namedRecipientSql} AND ${sendableChannelSql} ORDER BY rt.name`).all(locale) as ContactableRecipient[];
}

export function getContactableRecipient(db: Db, locale: Locale, id: number): ContactableRecipient | undefined {
  return db.prepare(`${namedRecipientSql} AND r.id = ? AND ${sendableChannelSql}`).get(locale, id) as ContactableRecipient | undefined;
}

export function hasSendableChannel(recipient: Pick<Recipient, "email" | "whatsapp">): boolean {
  return Boolean(recipient.email?.trim() || recipient.whatsapp?.trim());
}

export function listDirectoryBrowse(db: Db, locale: Locale): DirectoryBrowseItem[] {
  return listNamedRecipients(db, locale).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    contactable: hasSendableChannel(row)
  }));
}

export function mention(recipient: Pick<Recipient, "name" | "socialHandle">): string {
  return recipient.socialHandle?.trim() || recipient.name;
}
