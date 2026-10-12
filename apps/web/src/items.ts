import { insertItem, listItems } from "./db";
import { error, json, readJson } from "./http";
import { validateNewItem, validateStatus } from "./validate";

export async function getItems(request: Request, env: Env): Promise<Response> {
  const status = validateStatus(new URL(request.url).searchParams.get("status"));
  if (!status.ok) return error(400, status.message);

  return json({ items: await listItems(env.DB, status.value) });
}

export async function createItem(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return error(body.status, body.message);

  const input = validateNewItem(body.value);
  if (!input.ok) return error(400, input.message);

  const item = await insertItem(env.DB, input.value);
  return json({ item }, 201);
}
