import type { Config } from "./config.js";

export async function sendEmail(config: Config, to: string, subject: string, html: string) {
  if (!config.emailApiKey || !config.emailFrom) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${config.emailApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: config.emailFrom, to: [to], subject, html })
    });
    return response.ok;
  } catch { return false; }
}
