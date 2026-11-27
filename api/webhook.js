import crypto from "crypto";
import { fulfill, handler, httpErr } from "./_lib.js";
// Backup path: Paystack calls this even if the buyer closes the tab before returning to the site.
export default handler(async (req, res) => {
  const hash = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest("hex");
  if (hash !== req.headers["x-paystack-signature"]) throw httpErr(401, "Bad signature.");
  if (req.body.event === "charge.success") await fulfill(req.body.data.reference);
  res.status(200).json({ received: true });
});
