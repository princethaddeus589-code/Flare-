import { handleUpload } from "@vercel/blob/client";
import { handler, httpErr } from "./_lib.js";
import { sign } from "./_sign.js";

export default handler(async (req, res) => {
  if (req.method !== "POST") throw httpErr(405, "Use POST.");
  const json = await handleUpload({
    body: req.body,
    request: req,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const [uid, exp, sig] = String(clientPayload || "").split(".");
      if (!uid || !exp || sig !== sign(`${uid}.${exp}`) || Date.now() > Number(exp)) throw new Error("Upload not allowed.");
      if (!pathname.startsWith(`flare/${uid}/`)) throw new Error("Bad upload path.");
      return {
        allowedContentTypes: ["image/*", "video/*"],
        maximumSizeInBytes: 50 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: uid,
      };
    },
    onUploadCompleted: async () => {},
  });
  res.json(json);
});
