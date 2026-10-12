// Local fake servers for tests. Nothing here talks to the real internet.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface Recorded {
  method: string;
  url: string;
  headers: IncomingMessage["headers"];
  body: string;
}

export interface FakeServer {
  url: string;
  requests: Recorded[];
  close(): Promise<void>;
}

/** An HTTP server on a random local port that records requests and answers with `handler`. */
export async function startHttpServer(
  handler: (request: Recorded, response: ServerResponse) => void | Promise<void>,
): Promise<FakeServer> {
  const requests: Recorded[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const recorded = { method: req.method ?? "", url: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks).toString("utf8") };
    requests.push(recorded);
    await handler(recorded, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/** A logger that keeps lines in memory, so tests can check what was (and wasn't) logged. */
export function memoryLogger() {
  const lines: string[] = [];
  return {
    lines,
    info: (message: string) => void lines.push(`INFO ${message}`),
    warn: (message: string) => void lines.push(`WARN ${message}`),
    error: (message: string) => void lines.push(`ERROR ${message}`),
  };
}

/** A Messages API answer as the real API shapes it (only the fields the job reads matter). */
export function messageResponse(text: string, stopReason = "end_turn") {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content: [{ type: "thinking", thinking: "", signature: "sig" }, { type: "text", text }],
    stop_reason: stopReason,
    stop_sequence: null,
    stop_details: stopReason === "refusal" ? { type: "refusal", category: null, explanation: null } : null,
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

import { createServer as createTcpServer } from "node:net";

export interface FakeSmtp {
  url: string;
  received: { user: string; password: string; from: string; to: string[]; data: string }[];
  close(): Promise<void>;
}

/**
 * A tiny SMTP server on a random local port: just enough for curl to log in and
 * hand over one message. `acceptLogin: false` rejects the credentials.
 */
export async function startSmtpServer({ acceptLogin = true } = {}): Promise<FakeSmtp> {
  const received: FakeSmtp["received"] = [];
  const server = createTcpServer((socket) => {
    let buffer = "";
    let inData = false;
    let awaitingAuth = false;
    let current = { user: "", password: "", from: "", to: [] as string[], data: "" };
    const reply = (line: string) => socket.write(`${line}\r\n`);
    const login = (encoded: string) => {
      const [, user, password] = Buffer.from(encoded, "base64").toString("utf8").split("\0");
      current.user = user ?? "";
      current.password = password ?? "";
      reply(acceptLogin ? "235 2.7.0 Accepted" : "535 5.7.8 Username and Password not accepted");
    };

    reply("220 fake.local ESMTP");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      while (true) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) return;
          current.data = buffer.slice(0, end + 2);
          buffer = buffer.slice(end + 5);
          inData = false;
          received.push(current);
          current = { user: current.user, password: current.password, from: "", to: [], data: "" };
          reply("250 2.0.0 OK queued");
          continue;
        }
        const newline = buffer.indexOf("\r\n");
        if (newline === -1) return;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        const upper = line.toUpperCase();
        if (awaitingAuth) {
          awaitingAuth = false;
          login(line);
        } else if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          socket.write("250-fake.local\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
        } else if (upper.startsWith("AUTH PLAIN")) {
          const inline = line.slice("AUTH PLAIN".length).trim();
          if (inline) login(inline);
          else {
            awaitingAuth = true;
            reply("334 ");
          }
        } else if (upper.startsWith("MAIL FROM:")) {
          current.from = line.slice(10).trim().replace(/^<|>.*$/g, "");
          reply("250 2.1.0 OK");
        } else if (upper.startsWith("RCPT TO:")) {
          current.to.push(line.slice(8).trim().replace(/^<|>.*$/g, ""));
          reply("250 2.1.5 OK");
        } else if (upper === "DATA") {
          inData = true;
          reply("354 Go ahead");
        } else if (upper === "QUIT") {
          reply("221 2.0.0 Bye");
          socket.end();
        } else {
          reply("250 OK");
        }
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `smtp://127.0.0.1:${port}`, received, close: () => new Promise((resolve) => server.close(() => resolve())) };
}
