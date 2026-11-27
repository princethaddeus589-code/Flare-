import { useEffect, useMemo, useState } from "react";
import { api, naira } from "./api.js";

const DAY = 86400000;
const sod = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const ago = (t) => {
  if (!t) return "never";
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return new Date(t).toLocaleDateString();
};
function series(items, days, valueOf = () => 1) {
  const first = sod(Date.now()) - (days - 1) * DAY;
  const out = Array.from({ length: days }, (_, i) => ({ t: first + i * DAY, value: 0 }));
  items.forEach((it) => {
    if (!it.created) return;
    const i = Math.round((sod(it.created) - first) / DAY);
    if (i >= 0 && i < days) out[i].value += valueOf(it);
  });
  return out;
}

function Card({ title, sub, children }) {
  return <section className="ad-card"><header><h3>{title}</h3>{sub && <small>{sub}</small>}</header>{children}</section>;
}
function Bars({ data, color, fmt = (v) => v }) {
  const max = Math.max(...data.map((x) => x.value), 1);
  return (
    <div className="ad-bars">
      {data.map((x, i) => (
        <div className="ad-bar" key={i} title={`${new Date(x.t).toLocaleDateString()}: ${fmt(x.value)}`}>
          <div className="col"><i style={{ height: Math.max(x.value ? 6 : 2, Math.round((x.value / max) * 92)) + "px", background: color }} /></div>
          <span>{i % 2 === 0 ? new Date(x.t).getDate() : ""}</span>
        </div>
      ))}
    </div>
  );
}
function Meter({ label, a, b }) {
  return (
    <div className="ad-hrow">
      <div><span>{label}</span><b>{pc(a, b)}% <small>({a}/{b})</small></b></div>
      <div className="ad-track"><i style={{ width: pc(a, b) + "%" }} /></div>
    </div>
  );
}
const Kpi = ({ label, value, note, up }) => (
  <div className="ad-kpi"><small>{label}</small><b>{value}</b><span className={up ? "up" : ""}>{note}</span></div>
);
const Badge = ({ kind = "", children }) => <span className={`ad-badge ${kind}`}>{children}</span>;

export default function Admin() {
  const [d, setD] = useState(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("activity"); const [q, setQ] = useState(""); const [more, setMore] = useState(40);

  const load = async () => {
    setBusy(true); setErr("");
    try { setD({ ...(await api("admin", { view: "dashboard" })), at: Date.now() }); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  useEffect(() => { load(); }, []);
  const act = async (body, ask) => {
    if (ask && !confirm(ask)) return;
    try { await api("admin", body); await load(); } catch (e) { setErr(e.message); }
  };

  const m = useMemo(() => {
    if (!d) return null;
    const { users, listings, orders } = d; const now = Date.now();
    const week = (arr) => arr.filter((i) => i.created >= now - 7 * DAY);
    const sales = orders.reduce((s, o) => s + (o.amountNgn || 0), 0);
    const byCat = {}; listings.forEach((l) => { byCat[l.category] = (byCat[l.category] || 0) + 1; });
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const sellerMap = {};
    orders.forEach((o) => {
      const s = sellerMap[o.sellerId] || (sellerMap[o.sellerId] = { name: o.sellerName, total: 0, n: 0 });
      s.total += o.amountNgn || 0; s.n += 1;
    });
    const feed = [];
    users.forEach((u) => {
      feed.push({ at: u.created, icon: "👤", text: `${u.name || u.email} created an account (${u.provider})` });
      if (u.lastSignIn - u.created > 300000) feed.push({ at: u.lastSignIn, icon: "🔑", text: `${u.name || u.email} signed in` });
    });
    listings.forEach((l) => feed.push({ at: l.created, icon: l.kind === "product" ? "🛍️" : "🛠️", text: `${l.owner} posted a ${l.kind}: "${l.title}" at ${naira(l.priceNgn || 0)}` }));
    orders.forEach((o) => feed.push({ at: o.created, icon: "💳", text: `${o.buyerName || o.buyerEmail} paid ${naira(o.amountNgn)} to ${o.sellerName} for "${o.title}"` }));
    return {
      sales, cats, feed: feed.sort((a, b) => b.at - a.at).slice(0, 200),
      newUsers: week(users).length, newListings: week(listings).length, newOrders: week(orders).length,
      salesWeek: week(orders).reduce((s, o) => s + (o.amountNgn || 0), 0),
      active7: users.filter((u) => u.lastSignIn >= now - 7 * DAY).length,
      posters: users.filter((u) => u.listings > 0).length, payouts: users.filter((u) => u.payoutReady).length,
      buyers: users.filter((u) => u.bought > 0).length, verified: users.filter((u) => u.verified).length,
      products: listings.filter((l) => l.kind === "product").length,
      topSellers: Object.values(sellerMap).sort((a, b) => b.total - a.total).slice(0, 5),
      topPosters: [...users].filter((u) => u.listings > 0).sort((a, b) => b.listings - a.listings).slice(0, 5),
      uSeries: series(users, 14), lSeries: series(listings, 14), sSeries: series(orders, 14, (o) => o.amountNgn || 0),
    };
  }, [d]);

  if (err && !d) return <div className="empty"><p>{err}</p><button className="ad-act" onClick={load}>Try again</button></div>;
  if (!d || !m) return <div className="empty"><p>Loading dashboard…</p></div>;

  const has = (...v) => v.join(" ").toLowerCase().includes(q.toLowerCase());
  const { users, listings, orders } = d;
  const switchTab = (k) => { setTab(k); setMore(40); };
  const maxCat = Math.max(...m.cats.map((c) => c[1]), 1);
  const aov = orders.length ? Math.round(m.sales / orders.length) : 0;
  const sum = (arr) => arr.reduce((s, x) => s + x.value, 0);

  const Rows = ({ list, render }) => (<>
    {list.slice(0, more).map(render)}
    {list.length === 0 && <div className="empty"><p>Nothing here yet.</p></div>}
    {list.length > more && <button className="ad-act wide" onClick={() => setMore(more + 40)}>Show more ({list.length - more} left)</button>}
  </>);

  return (
    <div className="ad">
      <div className="ad-head">
        <div><small>Admin</small><h2>Dashboard</h2><em>Updated {ago(d.at)}</em></div>
        <button className="ad-act" onClick={load} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</button>
      </div>
      {err && <p className="msg err">{err}</p>}

      <div className="ad-kpis">
        <Kpi label="Accounts" value={users.length} note={`+${m.newUsers} this week`} up={m.newUsers > 0} />
        <Kpi label="Listings" value={listings.length} note={`+${m.newListings} this week`} up={m.newListings > 0} />
        <Kpi label="Paid orders" value={orders.length} note={`+${m.newOrders} this week`} up={m.newOrders > 0} />
        <Kpi label="Total sales" value={naira(m.sales)} note={`${naira(m.salesWeek)} this week`} up={m.salesWeek > 0} />
        <Kpi label={`Your share (~${d.stats.pct}%)`} value={naira(d.stats.platformShare)} note="before Paystack fees" />
        <Kpi label="Average order" value={naira(aov)} note="per paid order" />
        <Kpi label="Active (7 days)" value={m.active7} note={`${pc(m.active7, users.length)}% of accounts`} up={m.active7 > 0} />
        <Kpi label="Sellers" value={m.posters} note={`${m.products} products · ${listings.length - m.products} services`} />
      </div>

      <div className="ad-grid">
        <Card title="New accounts" sub={`last 14 days · ${sum(m.uSeries)}`}><Bars data={m.uSeries} color="#ff4000" /></Card>
        <Card title="New listings" sub={`last 14 days · ${sum(m.lSeries)}`}><Bars data={m.lSeries} color="#7a2a8f" /></Card>
        <Card title="Sales" sub={`last 14 days · ${naira(sum(m.sSeries))}`}><Bars data={m.sSeries} color="#128c7e" fmt={naira} /></Card>
        <Card title="Marketplace health" sub="share of all accounts">
          <div className="ad-h">
            <Meter label="Active in last 7 days" a={m.active7} b={users.length} />
            <Meter label="Posted a listing" a={m.posters} b={users.length} />
            <Meter label="Payout account set up" a={m.payouts} b={users.length} />
            <Meter label="Bought something" a={m.buyers} b={users.length} />
            <Meter label="Email verified" a={m.verified} b={users.length} />
          </div>
        </Card>
        <Card title="Listings by category" sub={`${m.products} products · ${listings.length - m.products} services`}>
          <div className="ad-h">
            {m.cats.length === 0 && <small>No listings yet.</small>}
            {m.cats.map(([c, n]) => (
              <div className="ad-hrow" key={c}><div><span>{c}</span><b>{n}</b></div><div className="ad-track"><i style={{ width: pc(n, maxCat) + "%" }} /></div></div>))}
          </div>
        </Card>
        <Card title="Top sellers" sub="by sales">
          <div className="ad-h">
            {m.topSellers.length === 0 && <small>No sales yet.</small>}
            {m.topSellers.map((s, i) => <div className="ad-line" key={i}><span>{i + 1}. {s.name || "Member"}</span><b>{naira(s.total)} <small>· {s.n} {s.n === 1 ? "order" : "orders"}</small></b></div>)}
          </div>
        </Card>
        <Card title="Most active posters" sub="by listings">
          <div className="ad-h">
            {m.topPosters.length === 0 && <small>No listings yet.</small>}
            {m.topPosters.map((u, i) => <div className="ad-line" key={u.uid}><span>{i + 1}. {u.name || u.email}</span><b>{u.listings}</b></div>)}
          </div>
        </Card>
      </div>

      <div className="chips" style={{ paddingTop: 6 }}>
        {[["activity", "Activity"], ["users", "Users"], ["listings", "Listings"], ["payments", "Payments"]].map(([k, l]) =>
          <button key={k} className={tab === k ? "on" : ""} onClick={() => switchTab(k)}>{l}</button>)}
      </div>
      <label className="searchbtn field"><input placeholder="Search names, emails, titles…" value={q} onChange={(e) => { setQ(e.target.value); setMore(40); }} /></label>

      <div className="ad-list">
        {tab === "activity" && <Rows list={m.feed.filter((e) => has(e.text))} render={(e, i) => (
          <div className="ad-row" key={i}><div className="ad-av">{e.icon}</div><div className="ad-main"><b>{e.text}</b><small>{ago(e.at)}</small></div><span /></div>)} />}

        {tab === "users" && <Rows list={users.filter((u) => has(u.name, u.email))} render={(u) => (
          <div className="ad-row" key={u.uid}>
            <div className="ad-av">{(u.name || u.email || "?")[0].toUpperCase()}</div>
            <div className="ad-main"><b>{u.name || "No name"}</b><small>{u.email}</small>
              <small>Joined {ago(u.created)} · last sign-in {ago(u.lastSignIn)}</small>
              <small>{u.listings} listings · bought {u.bought} · sold {u.sold}</small>
              <div className="ad-badges">
                <Badge>{u.provider}</Badge>
                <Badge kind={u.verified ? "ok" : "warn"}>{u.verified ? "Verified" : "Not verified"}</Badge>
                <Badge kind={u.payoutReady ? "ok" : ""}>{u.payoutReady ? `Payout ${u.payoutName} ••${u.accountLast4}` : "No payout"}</Badge>
                {u.disabled && <Badge kind="bad">Suspended</Badge>}
              </div></div>
            <button className="ad-act" onClick={() => act({ view: "set-user-disabled", uid: u.uid, disabled: !u.disabled }, u.disabled ? "Restore this account?" : "Suspend this account? They will be signed out.")}>{u.disabled ? "Restore" : "Suspend"}</button>
          </div>)} />}

        {tab === "listings" && <Rows list={listings.filter((l) => has(l.title, l.owner, l.category, l.location, l.description))} render={(l) => (
          <div className="ad-row" key={l.id}>
            <div className="ad-av">{l.kind === "product" ? "🛍️" : "🛠️"}</div>
            <div className="ad-main"><b>{l.title}</b><small>{naira(l.priceNgn || 0)} {l.unit} · {l.category}</small>
              <small>{l.owner} ({l.email}) · {l.location} · {ago(l.created)}</small><small>{l.description}</small>
              <div className="ad-badges"><Badge kind={l.kind === "product" ? "ok" : ""}>{l.kind}</Badge></div></div>
            <button className="ad-act red" onClick={() => act({ view: "delete-listing", id: l.id }, "Delete this listing for everyone?")}>Delete</button>
          </div>)} />}

        {tab === "payments" && <Rows list={orders.filter((o) => has(o.title, o.buyerName, o.buyerEmail, o.sellerName, o.reference))} render={(o) => (
          <div className="ad-row" key={o.reference}>
            <div className="ad-av">💳</div>
            <div className="ad-main"><b>{o.title}</b><small>Buyer: {o.buyerName} ({o.buyerEmail})</small><small>Seller: {o.sellerName}</small>
              <small>{ago(o.created)} · ref {o.reference}</small></div>
            <div className="ad-amt">{naira(o.amountNgn)}<br /><Badge kind="ok">Paid</Badge></div>
          </div>)} />}
      </div>
    </div>
  );
}
