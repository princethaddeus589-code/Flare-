import crypto from "crypto";
export const sign = (data) =>
  crypto.createHmac("sha256", process.env.BLOB_READ_WRITE_TOKEN || "").update(data).digest("hex");
