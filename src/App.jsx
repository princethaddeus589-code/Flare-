import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { api } from "./api.js";
import Intro from "./Intro.jsx";
import Auth from "./Auth.jsx";
import { I } from "./icons.jsx";
import { Detail, Explore, Home, Orders, Profile, Sell } from "./screens.jsx";

const NAV = [["home", I.home, "Home"], ["explore", I.grid, "Explore"], ["sell", I.plus, "Sell"], ["orders", I.bag, "Orders"], ["profile", I.user, "Profile"]];

export default function App() {
  const [intro, setIntro] = useState(() => !sessionStorage.getItem("flare-intro"));
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [favs, setFavs] = useState(new Set());
  const [tab, setTab] = useState("home");
  const [cat, setCat] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => onSnapshot(query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(120)),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}), []);
  useEffect(() => {
    if (!user) { setProfile(null); setFavs(new Set()); return; }
    const a = onSnapshot(doc(db, "users", user.uid), (s) => setProfile(s.data() || {}), () => {});
    const b = onSnapshot(collection(db, "users", user.uid, "favs"), (s) => setFavs(new Set(s.docs.map((d) => d.id))), () => {});
    return () => { a(); b(); };
  }, [user]);

  // Back from Paystack: confirm the payment with the server, then show the order.
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get("reference");
    if (!ref || user === undefined) return;
    history.replaceState({}, "", "/");
    if (!user) return setAuthOpen(true);
    api("verify", { reference: ref })
      .then((r) => { setToast(`Payment confirmed: ${r.title}`); setTab("orders"); })
      .catch((e) => setToast(e.message));
  }, [user]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 5000); return () => clearTimeout(t); } }, [toast]);

  const needAuth = () => setAuthOpen(true);
  const onFav = (id) => {
    if (!user) return needAuth();
    const r = doc(db, "users", user.uid, "favs", id);
    favs.has(id) ? deleteDoc(r) : setDoc(r, { at: Date.now() });
  };
  const open = (i) => setDetail(i);
  const go = (t) => { setTab(t); window.scrollTo(0, 0); };
  const finishIntro = () => { sessionStorage.setItem("flare-intro", "1"); setIntro(false); };

  return (<>
    {intro && <Intro onDone={finishIntro} />}
    <header className="nav">
      <a className="brand" href="/"><img src="/logo.svg" alt="" />Flare</a>
      {user === null && <button className="signin" onClick={needAuth}>Sign in</button>}
    </header>
    <main>
      {tab === "home" && <Home user={user} items={items} favs={favs} onFav={onFav} onOpen={open} go={go} setCat={setCat} startPost={() => go("sell")} />}
      {tab === "explore" && <Explore items={items} favs={favs} onFav={onFav} onOpen={open} cat={cat} setCat={setCat} />}
      {tab === "sell" && <Sell user={user} profile={profile} openAuth={needAuth} onPosted={() => { setToast("Your listing is live."); go("profile"); }} />}
      {tab === "orders" && <Orders user={user} openAuth={needAuth} />}
      {tab === "profile" && <Profile user={user} profile={profile} items={items} favs={favs} onOpen={open} openAuth={needAuth} signOut={() => signOut(auth)} />}
    </main>
    <nav className="dock" aria-label="Main">
      {NAV.map(([k, icon, label]) => <button key={k} className={`${tab === k ? "on" : ""} ${k === "sell" ? "sellbtn" : ""}`} aria-label={label} onClick={() => go(k)}>{icon}</button>)}
    </nav>
    {toast && <div className="toast" role="status">{toast}</div>}
    {authOpen && <Auth onClose={() => setAuthOpen(false)} />}
    {detail && <Detail i={detail} user={user} onClose={() => setDetail(null)} openAuth={() => { setDetail(null); needAuth(); }} />}
  </>);
}
