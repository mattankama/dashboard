import { insertItem, listItems, updateItem } from "./db";
import { error, json, readJson } from "./http";
import { validateNewItem, validatePatch, validateStatus } from "./validate";

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

export async function patchItem(
  request: Request,
  env: Env,
  params: Record<string, string | undefined>,
): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return error(body.status, body.message);

  const patch = validatePatch(body.value);
  if (!patch.ok) return error(400, patch.message);

  const item = await updateItem(env.DB, params.id ?? "", patch.value);
  if (item === null) return error(404, "Item not found");
  return json({ item });
}
