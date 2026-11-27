import { authUser, fulfill, handler, httpErr } from "./_lib.js";
export default handler(async (req, res) => {
  if (req.method !== "POST") throw httpErr(405, "Use POST.");
  const u = await authUser(req);
  const order = await fulfill(String((req.body || {}).reference || ""));
  if (order.buyerId !== u.uid) throw httpErr(403, "This payment belongs to another account.");
  res.json({ ok: true, title: order.title });
});
