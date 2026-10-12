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
