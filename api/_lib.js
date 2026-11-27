import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}
export const db = admin.firestore();
export const httpErr = (status, message) => Object.assign(new Error(message), { status });

export async function authUser(req) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) throw httpErr(401, "Sign in first.");
  try { return await admin.auth().verifyIdToken(token); }
  catch { throw httpErr(401, "Your session expired. Sign in again."); }
}

export async function paystack(path, method = "GET", body) {
  const r = await fetch("https://api.paystack.co" + path, {
    method,
    headers: { Authorization: "Bearer " + process.env.PAYSTACK_SECRET_KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!j.status) throw httpErr(400, j.message || "Paystack rejected the request.");
  return j.data;
}

export const handler = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ error: e.status ? e.message : "Server error. Please try again." });
  }
};

// Confirms a payment with Paystack and records the order once (safe to call many times).
export async function fulfill(reference) {
  const tx = await paystack("/transaction/verify/" + encodeURIComponent(reference));
  if (tx.status !== "success") throw httpErr(400, "Payment was not completed.");
  const m = tx.metadata || {};
  if (!m.listingId || tx.amount !== m.amountKobo) throw httpErr(400, "Payment details do not match.");
  const ref = db.collection("orders").doc(reference);
  const order = {
    reference, listingId: m.listingId, title: m.title, image: m.image || "", kind: m.kind,
    amountNgn: tx.amount / 100, buyerId: m.buyerId, buyerName: m.buyerName || "", buyerEmail: tx.customer?.email || "",
    sellerId: m.sellerId, sellerName: m.sellerName || "", status: "paid",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  try { await ref.create(order); } catch (e) { if (e.code !== 6) throw e; } // 6 = already exists
  return (await ref.get()).data();
}
