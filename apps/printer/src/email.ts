// Email through Gmail, using macOS's own curl (SMTPS): no mail library needed.
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Runner } from "./run.ts";

export const GMAIL_SMTP = "smtps://smtp.gmail.com:465";

export interface Email {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachment: { filename: string; content: Buffer };
}

const CRLF = "\r\n";

function noLineBreaks(value: string): string {
  if (/[\r\n]/.test(value)) throw new Error("an email header can't contain a line break");
  return value;
}

/** Plain ASCII as is; anything else as an RFC 2047 encoded word. */
function header(value: string): string {
  noLineBreaks(value);
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function base64Lines(content: Buffer): string {
  return (content.toString("base64").match(/.{1,76}/g) ?? []).join(CRLF);
}

/** RFC 5322 date, e.g. "Sun, 11 Oct 2026 16:02:00 +0000". */
function rfcDate(date: Date): string {
  return date.toUTCString().replace("GMT", "+0000");
}

/** A multipart/mixed message: the text, then the PDF. Both parts base64, lines CRLF. */
export function buildMessage(email: Email, { date = new Date() }: { date?: Date } = {}): string {
  const boundary = `dashboard-${randomUUID()}`;
  const filename = noLineBreaks(email.attachment.filename).replace(/"/g, "");
  return [
    `From: Dashboard <${noLineBreaks(email.from)}>`,
    `To: ${noLineBreaks(email.to)}`,
    `Subject: ${header(email.subject)}`,
    `Date: ${rfcDate(date)}`,
    `Message-ID: <${randomUUID()}@dashboard>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(Buffer.from(email.text.replace(/\r?\n/g, CRLF), "utf8")),
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(email.attachment.content),
    `--${boundary}--`,
    "",
  ].join(CRLF);
}

/** A value for curl's config file, quoted as curl expects. */
function curlQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export type SendResult = { ok: true } | { ok: false; reason: string };

/**
 * Sends with curl. The password goes to curl on stdin (its config), so it never
 * appears in the process list; the message sits in a private temp file meanwhile.
 */
export async function sendEmail(
  email: Email,
  { run, user, password, smtpUrl = GMAIL_SMTP }: { run: Runner; user: string; password: string; smtpUrl?: string },
): Promise<SendResult> {
  const work = await mkdtemp(path.join(tmpdir(), "dashboard-mail-"));
  try {
    const file = path.join(work, "message.eml");
    await writeFile(file, buildMessage(email), { mode: 0o600 });
    const result = await run(
      "curl",
      ["--silent", "--show-error", "--url", smtpUrl, "--mail-from", email.from, "--mail-rcpt", email.to, "--upload-file", file, "--config", "-"],
      { input: `user = ${curlQuote(`${user}:${password}`)}\n`, timeoutMs: 60_000 },
    );
    if (result.code === 0) return { ok: true };
    const detail = result.timedOut ? "timed out" : result.stderr.trim().split("\n").at(-1) ?? "";
    return { ok: false, reason: `curl failed (exit ${result.code ?? "none"}): ${detail}`.replaceAll(password, "***") };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
