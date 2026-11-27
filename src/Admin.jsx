import { useEffect, useMemo, useState } from "react";
import { api, naira } from "./api.js";

const ago = (t) => {
  if (!t) return "never";
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return new Date(t).toLocaleDateString();
};

export default function Admin() {
  const [d, setD] = useState(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("activity"); const [q, setQ] = useState("");

  const load = async () => {
    setBusy(true); setErr("");
    try { setD(await api("admin", { view: "dashboard" })); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  useEffect(() => { load(); }, []);
  const act = async (body, ask) => {
    if (ask && !confirm(ask)) return;
    try { await api("admin", body); await load(); } catch (e) { setErr(e.message); }
  };

  const feed = useMemo(() => {
    if (!d) return [];
    const ev = [];
    d.users.forEach((u) => {
      ev.push({ at: u.created, icon: "👤", text: `${u.name || u.email} created an account (${u.provider})` });
      if (u.lastSignIn - u.created > 300000) ev.push({ at: u.lastSignIn, icon: "🔑", text: `${u.name || u.email} signed in` });
    });
    d.listings.forEach((l) => ev.push({ at: l.created, icon: l.kind === "product" ? "🛍️" : "🛠️", text: `${l.owner} posted a ${l.kind}: "${l.title}" at ${naira(l.priceNgn || 0)}` }));
    d.orders.forEach((o) => ev.push({ at: o.created, icon: "💳", text: `${o.buyerName || o.buyerEmail} paid ${naira(o.amountNgn)} to ${o.sellerName} for "${o.title}"` }));
    return ev.sort((a, b) => b.at - a.at).slice(0, 150);
  }, [d]);

  const has = (...v) => v.join(" ").toLowerCase().includes(q.toLowerCase());
  if (err && !d) return <div className="empty"><p>{err}</p><button className="adminbtn" onClick={load}>Try again</button></div>;
  if (!d) return <div className="empty"><p>Loading dashboard…</p></div>;
  const stat = (n, label) => <div className="stat"><b>{n}</b><small>{label}</small></div>;

  return (<>
    <div className="greet"><div><small>Admin</small><h2>Dashboard</h2></div></div>
    <div className="stats">
      {stat(d.users.length, "Accounts")}
      {stat(d.listings.length, "Listings")}
      {stat(d.orders.length, "Paid orders")}
      {stat(naira(d.stats.revenue), "Total sales")}
      {stat(naira(d.stats.platformShare), `Your share (~${d.stats.pct}%)`)}
    </div>
    <div className="chips">
      {[["activity", "Activity"], ["users", "Users"], ["listings", "Listings"], ["payments", "Payments"]].map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      <button onClick={load} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</button>
    </div>
    <label className="searchbtn field" style={{ marginTop: 12 }}>
      <input placeholder="Search names, emails, titles…" value={q} onChange={(e) => setQ(e.target.value)} />
    </label>
    {err && <p className="msg err" style={{ marginTop: 10 }}>{err}</p>}

    <div className="alist">
      {tab === "activity" && feed.filter((e) => has(e.text)).map((e, i) => (
        <div className="arow" key={i}><span className="ico">{e.icon}</span><div><b>{e.text}</b><small>{ago(e.at)}</small></div></div>))}

      {tab === "users" && d.users.filter((u) => has(u.name, u.email)).map((u) => (
        <div className="arow" key={u.uid}>
          <div className="grow"><b>{u.name || "No name"} {u.disabled && <em className="tagx">Suspended</em>}</b>
            <small>{u.email} · {u.provider}{u.verified ? " · verified" : " · not verified"}</small>
            <small>Joined {ago(u.created)} · last sign-in {ago(u.lastSignIn)}</small>
            <small>{u.listings} listings · bought {u.bought} · sold {u.sold} · payout {u.payoutReady ? `${u.payoutName} ••${u.accountLast4}` : "not set"}</small></div>
          <button className="mini" onClick={() => act({ view: "set-user-disabled", uid: u.uid, disabled: !u.disabled }, u.disabled ? "Restore this account?" : "Suspend this account? They will be signed out.")}>{u.disabled ? "Restore" : "Suspend"}</button>
        </div>))}

      {tab === "listings" && d.listings.filter((l) => has(l.title, l.owner, l.category, l.location, l.description)).map((l) => (
        <div className="arow" key={l.id}>
          <div className="grow"><b>{l.title}</b><small>{l.kind} · {l.category} · {naira(l.priceNgn || 0)} {l.unit}</small>
            <small>By {l.owner} ({l.email}) · {l.location} · {ago(l.created)}</small><small>{l.description}</small></div>
          <button className="mini red" onClick={() => act({ view: "delete-listing", id: l.id }, "Delete this listing for everyone?")}>Delete</button>
        </div>))}

      {tab === "payments" && d.orders.filter((o) => has(o.title, o.buyerName, o.buyerEmail, o.sellerName, o.reference)).map((o) => (
        <div className="arow" key={o.reference}>
          <div className="grow"><b>{naira(o.amountNgn)} · {o.title}</b><small>Buyer: {o.buyerName} ({o.buyerEmail})</small>
            <small>Seller: {o.sellerName} · {ago(o.created)} · ref {o.reference}</small></div>
          <span className="paid">Paid</span>
        </div>))}
    </div>
  </>);
}
