import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { buildMessage, sendEmail, type Email } from "../src/email.ts";
import { run } from "../src/run.ts";
import { startSmtpServer, type FakeSmtp } from "./fakes.ts";

const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(3000, 7), Buffer.from("\n%%EOF\n")]);
const EMAIL: Email = {
  from: "sender@example.com",
  to: "me@example.com",
  subject: "Your dashboard printed",
  text: "This week's sheet printed on Sunday, October 11 at 9:02 AM.\nThe PDF is attached.",
  attachment: { filename: "dashboard-2026-10-11.pdf", content: PDF },
};

/** Splits a MIME message into its headers and its parts (each with headers and decoded body). */
function parse(message: string) {
  assert.ok(!/(?<!\r)\n/.test(message), "every line ends with CRLF");
  const [head, ...rest] = message.split("\r\n\r\n");
  const headers = Object.fromEntries(head.split("\r\n").map((l) => [l.slice(0, l.indexOf(":")).toLowerCase(), l.slice(l.indexOf(":") + 1).trim()]));
  const boundary = /boundary="([^"]+)"/.exec(headers["content-type"])![1];
  const body = rest.join("\r\n\r\n");
  const parts = body
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((part) => {
      const [partHead, partBody] = part.replace(/^\r\n/, "").split("\r\n\r\n");
      const partHeaders = Object.fromEntries(partHead.split("\r\n").map((l) => [l.slice(0, l.indexOf(":")).toLowerCase(), l.slice(l.indexOf(":") + 1).trim()]));
      return { headers: partHeaders, body: Buffer.from(partBody.replace(/\r\n/g, ""), "base64") };
    });
  return { headers, parts, body };
}

describe("buildMessage", () => {
  const message = buildMessage(EMAIL, { date: new Date("2026-10-11T16:02:00.000Z") });
  const { headers, parts, body } = parse(message);

  it("has the headers a mail client expects", () => {
    assert.equal(headers.from, "Dashboard <sender@example.com>");
    assert.equal(headers.to, "me@example.com");
    assert.equal(headers.subject, "Your dashboard printed");
    assert.equal(headers.date, "Sun, 11 Oct 2026 16:02:00 +0000");
    assert.equal(headers["mime-version"], "1.0");
    assert.match(headers["message-id"], /^<[0-9a-f-]+@dashboard>$/);
    assert.match(headers["content-type"], /^multipart\/mixed; boundary="/);
  });

  it("carries the text and the PDF, byte for byte", () => {
    assert.equal(parts.length, 2);
    assert.equal(parts[0].headers["content-type"], "text/plain; charset=utf-8");
    assert.equal(parts[0].body.toString("utf8"), EMAIL.text.replace(/\n/g, "\r\n"));
    assert.equal(parts[1].headers["content-type"], 'application/pdf; name="dashboard-2026-10-11.pdf"');
    assert.equal(parts[1].headers["content-disposition"], 'attachment; filename="dashboard-2026-10-11.pdf"');
    assert.ok(parts[1].body.equals(PDF));
  });

  it("wraps base64 at 76 characters", () => {
    assert.ok(body.split("\r\n").every((line) => line.length <= 76));
  });

  it("encodes a subject that isn't plain ASCII", () => {
    const { headers: h } = parse(buildMessage({ ...EMAIL, subject: "Sheet — Oct 11" }));
    assert.equal(h.subject, `=?UTF-8?B?${Buffer.from("Sheet — Oct 11").toString("base64")}?=`);
  });

  it("refuses header injection through a line break", () => {
    assert.throws(() => buildMessage({ ...EMAIL, subject: "Hi\r\nBcc: someone@else.com" }), /line break/);
  });
});

const servers: FakeSmtp[] = [];
after(async () => Promise.all(servers.map((s) => s.close())));

describe("sendEmail through the real curl, to a local fake SMTP server", () => {
  it("logs in and delivers the message to NOTIFY_TO only", async () => {
    const smtp = await startSmtpServer();
    servers.push(smtp);

    const result = await sendEmail(EMAIL, { run, smtpUrl: smtp.url, user: "sender@example.com", password: "app pass \"with\" quotes" });

    assert.deepEqual(result, { ok: true });
    assert.equal(smtp.received.length, 1);
    const [mail] = smtp.received;
    assert.equal(mail.user, "sender@example.com");
    assert.equal(mail.password, 'app pass "with" quotes');
    assert.equal(mail.from, "sender@example.com");
    assert.deepEqual(mail.to, ["me@example.com"]);
    assert.ok(parse(mail.data.replace(/\r\n$/, "")).parts[1].body.equals(PDF));
  });

  it("reports a rejected login without the password", async () => {
    const smtp = await startSmtpServer({ acceptLogin: false });
    servers.push(smtp);

    const result = await sendEmail(EMAIL, { run, smtpUrl: smtp.url, user: "sender@example.com", password: "s3cret-app-pass" });

    assert.equal(result.ok, false);
    assert.ok(!result.ok && /^curl failed \(exit 67/.test(result.reason), !result.ok ? result.reason : "");
    assert.ok(!result.ok && !result.reason.includes("s3cret-app-pass"));
  });

  it("reports a server that isn't there", async () => {
    const result = await sendEmail(EMAIL, { run, smtpUrl: "smtp://127.0.0.1:9", user: "u@x.com", password: "p" });
    assert.equal(result.ok, false);
  });
});
