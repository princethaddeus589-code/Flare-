import { authUser, db, handler, httpErr, paystack } from "./_lib.js";
export default handler(async (req, res) => {
  if (req.method !== "POST") throw httpErr(405, "Use POST.");
  const u = await authUser(req);
  const listingId = String((req.body || {}).listingId || "");
  const snap = await db.collection("listings").doc(listingId).get();
  if (!snap.exists) throw httpErr(404, "This listing is no longer available.");
  const l = snap.data();
  if (l.uid === u.uid) throw httpErr(400, "You can't buy your own listing.");
  if (!Number.isInteger(l.priceNgn)) throw httpErr(400, "This listing has no payable price.");
  const seller = (await db.collection("users").doc(l.uid).get()).data() || {};
  if (!seller.subaccount) throw httpErr(400, "This seller has not set up payouts yet.");
  const site = process.env.SITE_URL || `https://${req.headers.host}`;
  const data = await paystack("/transaction/initialize", "POST", {
    email: u.email, amount: l.priceNgn * 100, subaccount: seller.subaccount, callback_url: site + "/",
    metadata: {
      listingId, amountKobo: l.priceNgn * 100, title: l.title, image: l.image || "", kind: l.kind,
      buyerId: u.uid, buyerName: u.name || "", sellerId: l.uid, sellerName: l.owner || "",
    },
  });
  res.json({ url: data.authorization_url });
});
