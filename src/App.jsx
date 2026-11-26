import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import Intro from "./Intro.jsx";
import Auth from "./Auth.jsx";
import { Btn, Icon } from "./ui.jsx";

const CATS = {
  service: ["Design & creative", "Tech & development", "Writing & translation", "Teaching & tutoring", "Home & repairs", "Beauty & wellness", "Business & consulting", "Other"],
  product: ["Fashion", "Electronics", "Home & living", "Food & drink", "Art & handmade", "Beauty", "Books & media", "Other"],
};

export default function App() {
  const [intro, setIntro] = useState(() => !sessionStorage.getItem("flare-intro"));
  const [user, setUser] = useState(undefined);
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("service");
  const [q, setQ] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => onSnapshot(query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(80)),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}), []);

  const shown = useMemo(() => items.filter((i) => i.kind === tab &&
    `${i.title} ${i.category} ${i.location} ${i.description}`.toLowerCase().includes(q.toLowerCase())), [items, tab, q]);

  const finishIntro = () => { sessionStorage.setItem("flare-intro", "1"); setIntro(false); };
  const startPost = () => (user ? setPostOpen(true) : setAuthOpen(true));

  return (<>
    {intro && <Intro onDone={finishIntro} />}
    <header className="nav">
      <a className="brand" href="/"><img src="/logo.svg" alt="" />Flare</a>
      {user ? (
        <div className="who"><span>{user.displayName || user.email}</span><button onClick={() => signOut(auth)}>Sign out</button></div>
      ) : user === null ? <Btn kind="ghost" className="sm" onClick={() => setAuthOpen(true)}>Sign in</Btn> : null}
    </header>

    <main>
      <section className="hero">
        <h1>Find the people who pay for what you do.</h1>
        <p>Offer a service or sell a product. Buyers and clients from anywhere can find you and message you directly.</p>
        <div className="heroBtns"><Btn icon={Icon.plus} onClick={startPost}>Post a listing</Btn></div>
      </section>

      <div className="bar">
        <div className="seg" role="tablist">
          {["service", "product"].map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t === "service" ? "Services" : "Products"}</button>
          ))}
        </div>
        <label className="search">{Icon.search}<input placeholder="Search skills, products, cities" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>

      {shown.length === 0 ? (
        <div className="empty"><h3>{q ? "No matches yet" : `No ${tab === "service" ? "services" : "products"} listed yet`}</h3>
          <p>{q ? "Try a different word or city." : "Be the first. Your listing appears here the moment you post it."}</p>
          {!q && <Btn icon={Icon.plus} onClick={startPost}>Post a listing</Btn>}</div>
      ) : (
        <div className="grid">{shown.map((i) => <Card key={i.id} i={i} mine={user && user.uid === i.uid} />)}</div>
      )}
    </main>

    <footer>© {new Date().getFullYear()} Flare. Listings are posted by members; agree price and payment directly with the other person.</footer>
    <button className="fab" aria-label="Post a listing" onClick={startPost}>{Icon.plus}</button>
    {authOpen && <Auth onClose={() => setAuthOpen(false)} />}
    {postOpen && user && <Post user={user} onClose={() => setPostOpen(false)} />}
  </>);
}

function Card({ i, mine }) {
  const wa = i.whatsapp?.replace(/\D/g, "");
  return (
    <article className="card">
      {i.image && <img src={i.image} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />}
      <div className="body">
        <span className="tag">{i.category}</span>
        <h3>{i.title}</h3>
        <p className="price">{i.price}</p>
        <p className="desc">{i.description}</p>
        <p className="meta">{i.owner} · {i.location}</p>
        <div className="actions">
          {wa && <Btn kind="wa" className="sm" icon={Icon.chat} onClick={() => window.open(`https://wa.me/${wa}?text=${encodeURIComponent(`Hi, I found "${i.title}" on Flare.`)}`, "_blank")}>WhatsApp</Btn>}
          {i.email && <Btn kind="ghost" className="sm" icon={Icon.mail} onClick={() => (location.href = `mailto:${i.email}?subject=${encodeURIComponent(i.title)}`)}>Email</Btn>}
          {mine && <button className="del" onClick={() => confirm("Delete this listing?") && deleteDoc(doc(db, "listings", i.id))}>Delete</button>}
        </div>
      </div>
    </article>
  );
}

function Post({ user, onClose }) {
  const [f, setF] = useState({ kind: "service", title: "", category: CATS.service[0], price: "", location: "", description: "", whatsapp: "", image: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const kind = (k) => setF({ ...f, kind: k, category: CATS[k][0] });

  const submit = async (e) => {
    e.preventDefault();
    if (!f.whatsapp.trim() && !user.email) return setErr("Add a WhatsApp number so people can reach you.");
    setBusy(true); setErr("");
    try {
      await addDoc(collection(db, "listings"), {
        ...f, title: f.title.trim(), description: f.description.trim(),
        uid: user.uid, owner: user.displayName || "Member", email: user.email || "", createdAt: serverTimestamp(),
      });
      onClose();
    } catch { setErr("Could not post. Check your connection and try again."); setBusy(false); }
  };

  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Post a listing</h2>
        <div className="seg full">
          {["service", "product"].map((k) => <button type="button" key={k} className={f.kind === k ? "on" : ""} onClick={() => kind(k)}>{k === "service" ? "I offer a service" : "I sell a product"}</button>)}
        </div>
        <input placeholder={f.kind === "service" ? "What do you do? e.g. Wedding photographer" : "Product name"} value={f.title} onChange={set("title")} maxLength={120} required />
        <select value={f.category} onChange={set("category")}>{CATS[f.kind].map((c) => <option key={c}>{c}</option>)}</select>
        <div className="two">
          <input placeholder="Price e.g. $40 / hour" value={f.price} onChange={set("price")} required />
          <input placeholder="City, Country" value={f.location} onChange={set("location")} required />
        </div>
        <textarea placeholder="Describe what you offer, experience, delivery or shipping." rows={4} value={f.description} onChange={set("description")} maxLength={2000} required />
        <input placeholder="WhatsApp number with country code, e.g. 2348012345678" value={f.whatsapp} onChange={set("whatsapp")} inputMode="tel" />
        <input placeholder="Image link (optional)" value={f.image} onChange={set("image")} type="url" />
        {err && <p className="msg err">{err}</p>}
        <Btn type="submit" className="block" disabled={busy}>{busy ? "Posting…" : "Publish"}</Btn>
      </form>
    </div>
  );
}
