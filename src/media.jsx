import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { api } from "./api.js";

const MAX_FILES = 6, MAX_IMG = 25 * 1024 * 1024, MAX_VID = 50 * 1024 * 1024;

export const opt = (u = "") => u;
export const coverOf = (media) => {
  const m = media.find((x) => x.type === "image") || media.find((x) => x.poster);
  return m ? (m.type === "image" ? m.url : m.poster) : "";
};

// Shrinks big phone photos to about 1600 px before upload (faster pages, less storage)
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

// Grabs a cover picture from a video (may fail on some phones; then the video shows without a cover)
function makePoster(file) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "metadata"; v.src = URL.createObjectURL(file);
    const done = (b) => { URL.revokeObjectURL(v.src); resolve(b); };
    v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      const s = Math.min(1, 800 / (v.videoWidth || 800));
      c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      c.toBlob(done, "image/jpeg", 0.8);
    };
    v.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
  });
}

async function send(file, onPct) {
  const { ticket, uid } = await api("upload-ticket", {});
  const name = (file.name || "file").replace(/[^\w.-]+/g, "_").slice(-60);
  const blob = await upload(`flare/${uid}/${name}`, file, {
    access: "public",
    handleUploadUrl: "/api/blob-upload",
    clientPayload: ticket,
    contentType: file.type || undefined,
    onUploadProgress: (p) => onPct(Math.round(p.percentage)),
  });
  return blob.url;
}

export function MediaPicker({ media, setMedia, setBusy, required }) {
  const input = useRef(); const [pct, setPct] = useState(null); const [err, setErr] = useState("");

  const pick = async (e) => {
    const files = [...e.target.files]; e.target.value = "";
    setErr(""); setBusy(true);
    let list = [...media];
    try {
      for (const file of files) {
        const vid = file.type.startsWith("video"), img = file.type.startsWith("image");
        if (!vid && !img) { setErr("Only photos and videos are allowed."); continue; }
        if (list.length >= MAX_FILES) { setErr(`You can add up to ${MAX_FILES} files.`); break; }
        if (vid && list.some((m) => m.type === "video")) { setErr("Add one video per listing."); continue; }
        if (file.size > (vid ? MAX_VID : MAX_IMG)) { setErr(vid ? "Videos must be under 50 MB." : "Photos must be under 25 MB."); continue; }
        setPct(0);
        let item;
        if (vid) {
          const url = await send(file, setPct);
          const pb = await makePoster(file);
          const poster = pb ? await send(new File([pb], "cover.jpg", { type: "image/jpeg" }), () => {}) : "";
          item = { url, type: "video", poster };
        } else {
          item = { url: await send(await shrink(file), setPct), type: "image" };
        }
        list = [...list, item];
        setMedia(list);
      }
    } catch (x) { setErr(x.message || "Upload failed. Try again."); }
    setPct(null); setBusy(false);
  };

  return (
    <div className="mp">
      <div className="mp-head"><b>Photos and video{required ? " *" : ""}</b><small>{media.length}/{MAX_FILES} · one video up to 50 MB</small></div>
      <div className="mp-grid">
        {media.map((m, i) => (
          <div className="mp-item" key={m.url}>
            {(m.type === "video" ? m.poster : m.url) ? <img src={m.type === "video" ? m.poster : m.url} alt="" /> : <span className="mp-play" style={{ position: "static", transform: "none", margin: "auto" }}>🎬</span>}
            {m.type === "video" && <span className="mp-play">▶</span>}
            <button type="button" aria-label="Remove" onClick={() => setMedia(media.filter((_, k) => k !== i))}>×</button>
          </div>
        ))}
        {media.length < MAX_FILES && (
          <button type="button" className="mp-add" disabled={pct !== null} onClick={() => input.current.click()}>
            {pct !== null ? `${pct}%` : <><span>+</span>Add</>}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={pick} />
      {err && <p className="msg err">{err}</p>}
    </div>
  );
}

export function Gallery({ i }) {
  const items = i.media?.length ? i.media : i.image ? [{ url: i.image, type: "image" }] : [];
  if (!items.length) return null;
  return (
    <div className="gallery">
      {items.map((m) => m.type === "video"
        ? <video key={m.url} src={m.url} poster={m.poster || undefined} controls playsInline preload="metadata" />
        : <img key={m.url} src={m.url} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />)}
    </div>
  );
}
