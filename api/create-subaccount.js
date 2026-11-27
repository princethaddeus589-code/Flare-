import { authUser, db, handler, httpErr, paystack } from "./_lib.js";
export default handler(async (req, res) => {
  if (req.method !== "POST") throw httpErr(405, "Use POST.");
  const u = await authUser(req);
  const { bankCode, accountNumber } = req.body || {};
  if (!bankCode || !/^\d{10}$/.test(accountNumber || "")) throw httpErr(400, "Choose your bank and enter a 10-digit account number.");
  const acct = await paystack(`/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bankCode)}`);
  const sub = await paystack("/subaccount", "POST", {
    business_name: acct.account_name, settlement_bank: bankCode, account_number: accountNumber,
    percentage_charge: Number(process.env.PLATFORM_FEE_PERCENT || 5), // Flare's cut of each sale
  });
  await db.collection("users").doc(u.uid).set(
    { subaccount: sub.subaccount_code, payoutName: acct.account_name, accountLast4: accountNumber.slice(-4) }, { merge: true });
  res.json({ payoutName: acct.account_name });
});
