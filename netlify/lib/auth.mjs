// Shared editor check for the PUT endpoints.
//   - If EDITOR_EMAILS is set (comma-separated), only those addresses may edit.
//   - Otherwise any Identity user with the role "editor" or "admin".
import { getUser, verifyRequestOrigin } from "@netlify/identity";

export async function requireEditor(req) {
  try { verifyRequestOrigin(req); } catch { return { error: new Response("Bad origin", { status: 403 }) }; }
  const user = await getUser();
  if (!user) return { error: new Response("Sign in required", { status: 401 }) };
  const allow = (Netlify.env.get("EDITOR_EMAILS") || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const roles = user.roles || user.appMetadata?.roles || [];
  const ok = allow.length
    ? allow.includes((user.email || "").toLowerCase())
    : roles.includes("editor") || roles.includes("admin");
  if (!ok) return { error: new Response("No edit access", { status: 403 }) };
  return { user };
}

export const json = (body, init = {}) =>
  Response.json(body, { ...init, headers: { "cache-control": "no-store", ...(init.headers || {}) } });
