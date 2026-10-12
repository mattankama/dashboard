export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function error(status: number, message: string): Response {
  return json({ error: message }, status);
}
