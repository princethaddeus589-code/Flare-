import { auth } from "./firebase.js";
export async function api(path, body) {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Request failed. Try again.");
  return j;
}
export const naira = (n) => "₦" + Number(n).toLocaleString("en-NG");
