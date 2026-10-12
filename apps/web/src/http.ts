export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers });
}

export function error(status: number, message: string, headers?: HeadersInit): Response {
  return json({ error: message }, status, headers);
}

export type JsonBody = { ok: true; value: unknown } | { ok: false; status: 400 | 415; message: string };

// Requiring application/json also blocks plain cross-site form posts, which
// can't set that content type without a CORS preflight.
export async function readJson(request: Request): Promise<JsonBody> {
  const type = request.headers.get("Content-Type") ?? "";
  if (type.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { ok: false, status: 415, message: "Content-Type must be application/json" };
  }
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, status: 400, message: "Invalid JSON" };
  }
}
