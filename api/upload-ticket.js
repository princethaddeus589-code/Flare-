import { authUser, db, handler, httpErr } from "./_lib.js";
import { sign } from "./_sign.js";

// Gives a signed-in seller a short-lived ticket (10 minutes) that allows uploads.
export default handler(async (req, res) => {
  if (req.method !== "POST") throw httpErr(405, "Use POST.");
  const u = await authUser(req);
  const me = (await db.collection("users").doc(u.uid).get()).data() || {};
  if (!me.subaccount) throw httpErr(403, "Set up your payout account before uploading.");
  const body = `${u.uid}.${Date.now() + 10 * 60 * 1000}`;
  res.json({ ticket: `${body}.${sign(body)}`, uid: u.uid });
});
