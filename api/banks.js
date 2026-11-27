import { handler, paystack } from "./_lib.js";
export default handler(async (req, res) => {
  const banks = await paystack("/bank?country=nigeria&perPage=100&use_cursor=false");
  res.setHeader("Cache-Control", "s-maxage=86400");
  res.json(banks.map((b) => ({ name: b.name, code: b.code })).sort((a, b) => a.name.localeCompare(b.name)));
});
