import { useState } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup,
  sendPasswordResetEmail, updateProfile, sendEmailVerification,
} from "firebase/auth";
import { auth, google } from "./firebase.js";
import { Btn, Icon } from "./ui.jsx";

const msg = (e) => ({
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
  "auth/network-request-failed": "Network problem. Check your connection.",
}[e.code] || "Something went wrong. Please try again.");

export default function Auth({ onClose }) {
  const [mode, setMode] = useState("signin"); // signin | signup | reset
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const run = async (fn) => {
    setErr(""); setOk(""); setBusy(true);
    try { await fn(); } catch (e) { setErr(msg(e)); } finally { setBusy(false); }
  };
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (mode === "signup") {
        if (!f.name.trim()) throw { code: "x" };
        const { user } = await createUserWithEmailAndPassword(auth, f.email, f.password);
        await updateProfile(user, { displayName: f.name.trim() });
        sendEmailVerification(user).catch(() => {});
        onClose();
      } else if (mode === "signin") {
        await signInWithEmailAndPassword(auth, f.email, f.password); onClose();
      } else {
        await sendPasswordResetEmail(auth, f.email);
        setOk("Reset link sent. Check your inbox (and spam folder).");
      }
    });
  };
  const withGoogle = () => run(async () => { await signInWithPopup(auth, google); onClose(); });

  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet auth" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <img src="/logo.svg" alt="" className="mark" />
        <h2>{mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Sign in to Flare"}</h2>
        {mode !== "reset" && (<>
          <Btn type="button" kind="ghost" icon={Icon.google} onClick={withGoogle} disabled={busy} className="block">Continue with Google</Btn>
          <div className="or"><span>or</span></div>
        </>)}
        {mode === "signup" && <input placeholder="Full name" value={f.name} onChange={set("name")} autoComplete="name" required />}
        <input type="email" placeholder="Email" value={f.email} onChange={set("email")} autoComplete="email" required />
        {mode !== "reset" && <input type="password" placeholder="Password" value={f.password} onChange={set("password")} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required />}
        {err && <p className="msg err">{err}</p>}
        {ok && <p className="msg ok">{ok}</p>}
        <Btn type="submit" className="block" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</Btn>
        <div className="links">
          {mode === "signin" && <><button type="button" onClick={() => setMode("reset")}>Forgot password?</button><button type="button" onClick={() => setMode("signup")}>Create account</button></>}
          {mode !== "signin" && <button type="button" onClick={() => setMode("signin")}>Back to sign in</button>}
        </div>
      </form>
    </div>
  );
}
