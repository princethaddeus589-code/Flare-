import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { api, naira } from "./api.js";
import { Btn, Icon } from "./ui.jsx";
import { I } from "./icons.jsx";
import { Gallery, MediaPicker, coverOf, opt } from "./media.jsx";

export const CATS = {
  service: ["Design & creative", "Tech & development", "Writing & translation", "Teaching & tutoring", "Home & repairs", "Beauty & wellness", "Business & consulting", "Other"],
  product: ["Fashion", "Electronics", "Home & living", "Food & drink", "Art & handmade", "Beauty", "Books & media", "Other"],
};
const EMOJI = { "Design & creative": "✏️", "Tech & development": "💻", "Writing & translation": "📝", "Teaching & tutoring": "📚", "Home & repairs": "🔧", "Beauty & wellness": "💆", "Business & consulting": "💼", Fashion: "👗", Electronics: "📱", "Home & living": "🛋️", "Food & drink": "🍲", "Art & handmade": "🎨", Beauty: "💄", "Books & media": "📖", Other: "✨" };
const hue = (s = "") => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
const priceText = (i) => (i.priceNgn ? naira(i.priceNgn) + (i.unit ? ` · ${i.unit}` : "") : i.price || "");

export function Tile({ i, fav, onFav, onOpen }) {
  const h = hue(i.title);
  return (
    <article className="lc" onClick={() => onOpen(i)}>
      <div className="pic" style={i.image ? {} : { background: `linear-gradient(135deg,hsl(${h} 85% 92%),hsl(${(h + 45) % 360} 75% 82%))`, aspectRatio: "1/1" }}>
        {i.image ? <img src={opt(i.image)} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} /> : <span>{EMOJI[i.category] || "✨"}</span>}
        <button className="heart" aria-label="Save" onClick={(e) => { e.stopPropagation(); onFav(i.id); }}>{I.heart(fav)}</button>
      </div>
      <h4>{i.title}</h4>
      <p>{priceText(i)}</p>
    </article>
  );
}

export function Home({ user, items, favs, onFav, onOpen, go, setCat, startPost }) {
  const hr = new Date().getHours();
  const hello = hr < 12 ? "Good morning," : hr < 18 ? "Good afternoon," : "Good evening,";
  const cats = [...new Set([...CATS.product.slice(0, 4), ...CATS.service.slice(0, 3)])];
  return (<>
    <div className="greet"><div><small>{hello}</small><h2>{user?.displayName?.split(" ")[0] || "welcome"}</h2></div></div>
    <button className="searchbtn" onClick={() => go("explore")}>{Icon.search}<span>Search skills, products, cities</span><i>{I.filter}</i></button>
    <div className="rail">{cats.map((c) => (
      <button key={c} onClick={() => { setCat(c); go("explore"); }}><span style={{ background: `hsl(${hue(c)} 80% 92%)` }}>{EMOJI[c]}</span>{c.split(" ")[0]}</button>))}
    </div>
    <section className="promo"><small>Open to everyone</small><h3>Hire a pro.<br />Or sell your own.</h3><button onClick={startPost}>Post a listing</button></section>
    <div className="sec"><h3>Trending now</h3><button onClick={() => go("explore")}>See all</button></div>
    {items.length === 0 ? <Empty text="No listings yet. Be the first to post." action={<Btn icon={Icon.plus} onClick={startPost}>Post a listing</Btn>} /> :
      <div className="two-col">{items.slice(0, 8).map((i) => <Tile key={i.id} i={i} fav={favs.has(i.id)} onFav={onFav} onOpen={onOpen} />)}</div>}
  </>);
}

export function Empty({ text, action }) { return <div className="empty"><p>{text}</p>{action}</div>; }

export function Explore({ items, favs, onFav, onOpen, cat, setCat }) {
  const [kind, setKind] = useState("all"); const [q, setQ] = useState("");
  const cats = useMemo(() => [...new Set(kind === "all" ? [...CATS.product, ...CATS.service] : CATS[kind])], [kind]);
  const shown = items.filter((i) => (kind === "all" || i.kind === kind) && (!cat || i.category === cat) &&
    `${i.title} ${i.category} ${i.location} ${i.description}`.toLowerCase().includes(q.toLowerCase()));
  return (<>
    <div className="greet"><div><small>Discover</small><h2>Explore</h2></div></div>
    <label className="searchbtn field">{Icon.search}<input placeholder="Search skills, products, cities" value={q} onChange={(e) => setQ(e.target.value)} /></label>
    <div className="chips">{[["all", "All"], ["service", "Services"], ["product", "Products"]].map(([k, l]) =>
      <button key={k} className={kind === k ? "on" : ""} onClick={() => { setKind(k); setCat(""); }}>{l}</button>)}</div>
    <div className="chips light">{cats.map((c) => <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(cat === c ? "" : c)}>{c}</button>)}</div>
    {shown.length === 0 ? <Empty text="Nothing matches yet. Try another word, category or city." /> :
      <div className="masonry">{shown.map((i) => <Tile key={i.id} i={i} fav={favs.has(i.id)} onFav={onFav} onOpen={onOpen} />)}</div>}
  </>);
}

export function Sell({ user, profile, openAuth, onPosted }) {
  if (!user) return <div className="gate"><h2>Sell and get paid</h2><p>Sign in to post what you sell or what you do.</p><Btn onClick={openAuth}>Sign in</Btn></div>;
  return profile?.subaccount ? <PostForm user={user} onPosted={onPosted} /> : <Payout />;
}

function Payout() {
  const [banks, setBanks] = useState([]); const [bank, setBank] = useState(""); const [acct, setAcct] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { api("banks").then(setBanks).catch((x) => setErr("Could not load banks: " + x.message)); }, []);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("create-subaccount", { bankCode: bank, accountNumber: acct }); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <form className="panel" onSubmit={save}>
      <h2>Set up your payout account</h2>
      <p>Buyers pay through Paystack and your share goes straight to this bank account. We confirm the account name before saving.</p>
      <select value={bank} onChange={(e) => setBank(e.target.value)} required><option value="">Choose your bank</option>{banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</select>
      <input inputMode="numeric" maxLength={10} placeholder="10-digit account number" value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, ""))} required />
      {err && <p className="msg err">{err}</p>}
      <Btn type="submit" className="block" icon={I.lock} disabled={busy}>{busy ? "Verifying…" : "Verify and save"}</Btn>
    </form>
  );
}

function PostForm({ user, onPosted }) {
  const [f, setF] = useState({ kind: "service", title: "", category: CATS.service[0], priceNgn: "", unit: "per project", location: "", description: "", whatsapp: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState([]); const [up, setUp] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const kind = (k) => setF({ ...f, kind: k, category: CATS[k][0], unit: k === "service" ? "per project" : "" });
  const submit = async (e) => {
    e.preventDefault();
    const price = parseInt(f.priceNgn, 10);
    if (!(price >= 100)) return setErr("Enter a price of ₦100 or more.");
    if (f.kind === "product" && media.length === 0) return setErr("Add at least one photo or video of your product.");
    if (up) return setErr("Wait for the upload to finish.");
    setBusy(true); setErr("");
    try {
      await addDoc(collection(db, "listings"), {
        kind: f.kind, title: f.title.trim(), category: f.category, priceNgn: price, unit: f.unit, location: f.location.trim(),
        description: f.description.trim(), whatsapp: f.whatsapp.trim(), media, image: coverOf(media),
        uid: user.uid, owner: user.displayName || "Member", email: user.email || "", createdAt: serverTimestamp(),
      });
      onPosted();
    } catch { setErr("Could not post. Check your connection and try again."); setBusy(false); }
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2>Post a listing</h2>
      <div className="seg full">{["service", "product"].map((k) => <button type="button" key={k} className={f.kind === k ? "on" : ""} onClick={() => kind(k)}>{k === "service" ? "I offer a service" : "I sell a product"}</button>)}</div>
      <input placeholder={f.kind === "service" ? "What do you do? e.g. Wedding photographer" : "Product name"} value={f.title} onChange={set("title")} maxLength={120} required />
      <select value={f.category} onChange={set("category")}>{CATS[f.kind].map((c) => <option key={c}>{c}</option>)}</select>
      <div className="two"><input inputMode="numeric" placeholder="Price in ₦" value={f.priceNgn} onChange={(e) => setF({ ...f, priceNgn: e.target.value.replace(/\D/g, "") })} required />
        {f.kind === "service" ? <select value={f.unit} onChange={set("unit")}><option>per project</option><option>per hour</option><option>per day</option></select> : <input placeholder="City, Country" value={f.location} onChange={set("location")} required />}</div>
      {f.kind === "service" && <input placeholder="City, Country" value={f.location} onChange={set("location")} required />}
      <textarea rows={4} placeholder="Describe what you offer, experience, delivery or shipping." value={f.description} onChange={set("description")} maxLength={2000} required />
      <input inputMode="tel" placeholder="WhatsApp number with country code (optional)" value={f.whatsapp} onChange={set("whatsapp")} />
      <MediaPicker media={media} setMedia={setMedia} setBusy={setUp} required={f.kind === "product"} />
      {err && <p className="msg err">{err}</p>}
      <Btn type="submit" className="block" disabled={busy || up}>{busy ? "Posting…" : "Publish"}</Btn>
    </form>
  );
}

export function Orders({ user, openAuth }) {
  const [side, setSide] = useState("buyerId"); const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "orders"), where(side, "==", user.uid)),
      (s) => setRows(s.docs.map((d) => d.data()).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))), () => {});
  }, [user, side]);
  if (!user) return <div className="gate"><h2>Your orders</h2><p>Sign in to see what you bought and sold.</p><Btn onClick={openAuth}>Sign in</Btn></div>;
  return (<>
    <div className="greet"><div><small>Activity</small><h2>Orders</h2></div></div>
    <div className="seg full"><button className={side === "buyerId" ? "on" : ""} onClick={() => setSide("buyerId")}>Bought</button><button className={side === "sellerId" ? "on" : ""} onClick={() => setSide("sellerId")}>Sold</button></div>
    {rows.length === 0 ? <Empty text={side === "buyerId" ? "Nothing bought yet." : "No sales yet. Payments appear here the moment they clear."} /> :
      <div className="orders">{rows.map((o) => (
        <div className="order" key={o.reference}>
          <div><b>{o.title}</b><small>{side === "buyerId" ? `From ${o.sellerName}` : `To ${o.buyerName || o.buyerEmail}`} · {o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleDateString() : ""}</small></div>
          <div className="r"><b>{naira(o.amountNgn)}</b><span className="paid">{I.check}Paid</span></div>
          {side === "sellerId" && o.buyerEmail && <a className="mail" href={`mailto:${o.buyerEmail}?subject=${encodeURIComponent("Your order: " + o.title)}`}>Email buyer</a>}
        </div>))}</div>}
  </>);
}

export function Profile({ user, profile, items, favs, onOpen, openAuth, signOut }) {
  if (!user) return <div className="gate"><h2>Your profile</h2><p>Sign in to manage your listings and payouts.</p><Btn onClick={openAuth}>Sign in</Btn></div>;
  const mine = items.filter((i) => i.uid === user.uid); const saved = items.filter((i) => favs.has(i.id));
  return (<>
    <div className="me"><div className="av">{(user.displayName || user.email || "?")[0].toUpperCase()}</div><div><h2>{user.displayName || "Member"}</h2><small>{user.email}</small></div></div>
    <div className="panel slim"><b>Payouts</b><p>{profile?.subaccount ? `${profile.payoutName} · account ending ${profile.accountLast4}` : "Not set up yet. Open Sell to add your bank account."}</p></div>
    <div className="sec"><h3>My listings</h3></div>
    {mine.length === 0 ? <Empty text="You haven't posted anything yet." /> : mine.map((i) => (
      <div className="row" key={i.id}><div onClick={() => onOpen(i)}><b>{i.title}</b><small>{priceText(i)}</small></div>
        <button onClick={() => confirm("Delete this listing?") && deleteDoc(doc(db, "listings", i.id))}>Delete</button></div>))}
    {saved.length > 0 && <><div className="sec"><h3>Saved</h3></div>{saved.map((i) => <div className="row" key={i.id} onClick={() => onOpen(i)}><div><b>{i.title}</b><small>{priceText(i)}</small></div></div>)}</>}
    <Btn kind="ghost" className="block" onClick={signOut} style={{ marginTop: 24 }}>Sign out</Btn>
  </>);
}

export function Detail({ i, user, onClose, openAuth }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const wa = i.whatsapp?.replace(/\D/g, ""); const mine = user?.uid === i.uid;
  const pay = async () => {
    if (!user) return openAuth();
    setBusy(true); setErr("");
    try { const { url } = await api("initialize", { listingId: i.id }); location.href = url; }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet detail" onClick={(e) => e.stopPropagation()}>
        <Gallery i={i} />
        <span className="tag">{i.category}</span>
        <h2 style={{ textAlign: "left" }}>{i.title}</h2>
        <p className="price">{priceText(i)}</p>
        <p className="desc full">{i.description}</p>
        <p className="meta">{i.owner} · {i.location}</p>
        {err && <p className="msg err">{err}</p>}
        {mine ? <p className="msg ok">This is your listing.</p> : <>
          {i.priceNgn && <Btn className="block" icon={I.lock} onClick={pay} disabled={busy}>{busy ? "Opening Paystack…" : `Pay ${naira(i.priceNgn)} securely`}</Btn>}
          <div className="two">
            {wa && <Btn kind="wa" icon={Icon.chat} onClick={() => window.open(`https://wa.me/${wa}?text=${encodeURIComponent(`Hi, I saw "${i.title}" on Flare.`)}`, "_blank")}>WhatsApp</Btn>}
            {i.email && <Btn kind="ghost" icon={Icon.mail} onClick={() => (location.href = `mailto:${i.email}?subject=${encodeURIComponent(i.title)}`)}>Email</Btn>}
          </div></>}
      </div>
    </div>
  );
}
