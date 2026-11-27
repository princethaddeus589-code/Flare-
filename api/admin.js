import admin from "firebase-admin";
import { authUser, db, handler, httpErr } from "./_lib.js";

const admins = () => (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
async function requireAdmin(req) {
  const u = await authUser(req);
  if (!u.email_verified || !admins().includes((u.email || "").toLowerCase())) throw httpErr(403, "Admins only.");
  return u;
}
const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);

export default handler(async (req, res) => {
  const body = req.body || {};
  if (body.view === "me") {
    try { await requireAdmin(req); return res.json({ admin: true }); }
    catch (e) { if (e.status === 401 || e.status === 403) return res.json({ admin: false }); throw e; }
  }
  const me = await requireAdmin(req);

  if (body.view === "delete-listing") {
    await db.collection("listings").doc(String(body.id)).delete();
    return res.json({ ok: true });
  }
  if (body.view === "set-user-disabled") {
    if (body.uid === me.uid) throw httpErr(400, "You can't suspend your own account.");
    await admin.auth().updateUser(String(body.uid), { disabled: !!body.disabled });
    if (body.disabled) await admin.auth().revokeRefreshTokens(String(body.uid));
    return res.json({ ok: true });
  }
  if (body.view !== "dashboard") throw httpErr(400, "Unknown request.");

  const [authList, listSnap, orderSnap, userDocs] = await Promise.all([
    admin.auth().listUsers(1000),
    db.collection("listings").orderBy("createdAt", "desc").limit(500).get(),
    db.collection("orders").orderBy("createdAt", "desc").limit(500).get(),
    db.collection("users").get(),
  ]);
  const payout = {}; userDocs.forEach((d) => (payout[d.id] = d.data()));

  const listings = listSnap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, title: x.title, kind: x.kind, category: x.category, priceNgn: x.priceNgn, unit: x.unit || "", location: x.location,
      description: (x.description || "").slice(0, 300), owner: x.owner, uid: x.uid, email: x.email, whatsapp: x.whatsapp || "", created: ms(x.createdAt) };
  });
  const orders = orderSnap.docs.map((d) => {
    const x = d.data();
    return { reference: x.reference, title: x.title, amountNgn: x.amountNgn, buyerId: x.buyerId, buyerName: x.buyerName, buyerEmail: x.buyerEmail,
      sellerId: x.sellerId, sellerName: x.sellerName, status: x.status, created: ms(x.createdAt) };
  });
  const count = (arr, key, uid) => arr.filter((i) => i[key] === uid).length;
  const users = authList.users.map((u) => ({
    uid: u.uid, name: u.displayName || "", email: u.email || "", provider: u.providerData.map((p) => p.providerId.replace(".com", "")).join(", ") || "email",
    verified: u.emailVerified, disabled: u.disabled, created: Date.parse(u.metadata.creationTime) || 0, lastSignIn: Date.parse(u.metadata.lastSignInTime) || 0,
    payoutReady: !!(payout[u.uid] && payout[u.uid].subaccount), payoutName: payout[u.uid]?.payoutName || "", accountLast4: payout[u.uid]?.accountLast4 || "",
    listings: count(listings, "uid", u.uid), bought: count(orders, "buyerId", u.uid), sold: count(orders, "sellerId", u.uid),
  })).sort((a, b) => b.created - a.created);

  const revenue = orders.reduce((s, o) => s + (o.amountNgn || 0), 0);
  const pct = Number(process.env.PLATFORM_FEE_PERCENT || 5);
  res.json({ users, listings, orders, stats: { revenue, platformShare: Math.round((revenue * pct) / 100), pct } });
});
