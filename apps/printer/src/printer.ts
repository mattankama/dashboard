// The home printer, through macOS's CUPS tools (lp, lpstat, cancel) and Bonjour (dns-sd).
// Every command goes through the injected Runner; tests never reach the real printer.
import type { Runner } from "./run.ts";

export interface PrinterStatus {
  reachable: boolean;
  reason: string;
}

/** The Bonjour service behind a CUPS device URI like dnssd://CanonMF4800._pdl-datastream._tcp.local./?bidi */
function bonjourService(deviceUri: string): { name: string; type: string; domain: string } | null {
  const match = /^dnssd:\/\/([^/?]+)/.exec(deviceUri);
  if (!match) return null;
  const host = match[1]; // "CanonMF4800._pdl-datastream._tcp.local."
  const service = /^(.*?)\.(_[^.]+\._(?:tcp|udp))\.(.+)$/.exec(host);
  if (!service) return null;
  return { name: decodeURIComponent(service[1]), type: service[2], domain: service[3] };
}

/**
 * Reachable when the queue is enabled and the printer answers on Bonjour within
 * 3 seconds. Away from home the lookup gets no answer, and the job tries again later.
 */
export async function printerStatus(name: string, { run }: { run: Runner }): Promise<PrinterStatus> {
  const queue = await run("lpstat", ["-p", name], { timeoutMs: 10_000 });
  if (queue.code !== 0) return { reachable: false, reason: `there's no print queue named ${name}` };
  if (!/\benabled\b/.test(queue.stdout)) return { reachable: false, reason: `the ${name} queue is disabled` };

  const device = await run("lpstat", ["-v", name], { timeoutMs: 10_000 });
  const uri = /device for [^:]+:\s*(\S+)/.exec(device.stdout)?.[1] ?? "";
  const service = bonjourService(uri);
  if (service === null) return { reachable: true, reason: "the queue is enabled (its device isn't on Bonjour)" };

  // dns-sd never exits by itself: give it 3 seconds, then read what it found.
  const lookup = await run("dns-sd", ["-L", service.name, service.type, service.domain], { timeoutMs: 3_000 });
  if (lookup.stdout.includes("can be reached at")) return { reachable: true, reason: "the printer answered on the network" };
  return { reachable: false, reason: "the printer didn't answer on the network" };
}

export type PrintResult = { ok: true; job: string } | { ok: false; reason: string };

function minutes(ms: number): string {
  const n = Math.round(ms / 60_000);
  return `${n} minute${n === 1 ? "" : "s"}`;
}

/**
 * Prints the PDF on US Letter and waits until the job leaves the queue. A job
 * that's still waiting when time runs out is cancelled, so it can't come out
 * later on top of a retry.
 */
export async function printPdf(
  file: string,
  printer: string,
  title: string,
  {
    run,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    now = () => Date.now(),
    waitMs = 5 * 60_000,
    pollMs = 5_000,
  }: { run: Runner; sleep?: (ms: number) => Promise<void>; now?: () => number; waitMs?: number; pollMs?: number },
): Promise<PrintResult> {
  const submitted = await run("lp", ["-d", printer, "-o", "media=Letter", "-t", title, file], { timeoutMs: 30_000 });
  const job = /request id is (\S+)/.exec(submitted.stdout)?.[1];
  if (submitted.code !== 0 || !job) {
    return { ok: false, reason: `lp failed: ${submitted.stderr.trim() || submitted.stdout.trim() || `exit ${submitted.code}`}` };
  }

  const pending = new RegExp(`^${job.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s`, "m");
  const deadline = now() + waitMs;
  while (now() < deadline) {
    await sleep(pollMs);
    const queue = await run("lpstat", ["-W", "not-completed", "-o", printer], { timeoutMs: 10_000 });
    if (queue.code === 0 && !pending.test(queue.stdout)) return { ok: true, job };
  }

  await run("cancel", [job], { timeoutMs: 10_000 });
  return { ok: false, reason: `the print job didn't finish within ${minutes(waitMs)}; cancelled it` };
}
