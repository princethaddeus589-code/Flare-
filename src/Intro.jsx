import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Btn, Icon } from "./ui.jsx";

const WORDS = ["Design", "Photography", "Tutoring", "Repairs", "Handmade goods", "Fashion", "Consulting", "Fresh produce"];
const TILES = [
  ["Photographer", "Lagos", 6, 12, -6, "#ffe1d6"], ["Handmade bags", "Nairobi", 70, 8, 5, "#e8e8ff"],
  ["Math tutor", "Manila", 38, 6, -3, "#dff5e8"], ["Web designer", "Lisbon", 82, 34, 6, "#fff2c9"],
  ["Sneakers", "São Paulo", 4, 46, 4, "#e1f0ff"], ["Plumber", "Accra", 60, 60, -5, "#ffe1ec"],
  ["Ceramics", "Kyoto", 22, 70, 3, "#efe6ff"], ["Translator", "Cairo", 84, 72, -4, "#e4f7f2"],
  ["Tailoring", "Mumbai", 42, 82, 5, "#fff0e0"], ["Voice-over", "Toronto", 12, 24, 2, "#fde7f3"],
];

export default function Intro({ onDone }) {
  const [stage, setStage] = useState(0); // 0 tiles, 1 words, 2 promise
  const [i, setI] = useState(0);
  const [off, setOff] = useState(0);
  const refs = useRef([]);
  const [tick, setTick] = useState(0);
useEffect(() => { document.fonts?.ready.then(() => setTick((t) => t + 1)); }, []);

  useEffect(() => { const t = setTimeout(() => setStage(1), 3000); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (stage !== 1) return;
    const last = i >= WORDS.length - 1;
    const t = setTimeout(() => (last ? setStage(2) : setI(i + 1)), last ? 1000 : 850);
    return () => clearTimeout(t);
  }, [stage, i]);
  useLayoutEffect(() => {
    const el = refs.current[i];
    if (el) setOff(-(el.offsetLeft + el.offsetWidth / 2));
  }, [i, stage, tick]);

  return (
    <div className={`intro s${stage}`} role="dialog" aria-label="Welcome to Flare">
      <button className="skip" onClick={onDone}>Skip</button>

      <div className="tiles" aria-hidden="true">
        {TILES.map(([a, b, x, y, r, c], k) => (
          <div key={a} className="tile" style={{ left: `min(${x}%, calc(100% - 150px))`, top: y + "%", "--r": r + "deg", background: c, animationDelay: k * 0.18 + "s" }}>
            <b>{a}</b><span>{b}</span>
          </div>
        ))}
        <div className="center-logo"><img src="/logo.svg" alt="" /></div>
      </div>

      <div className="words" aria-live="polite">
        <div className="track" style={{ transform: `translateX(${off}px)` }}>
          {WORDS.map((w, k) => (
            <span key={w} ref={(el) => (refs.current[k] = el)} className={k === i ? "on" : ""}>{w}</span>
          ))}
        </div>
        <p>Whatever you do, someone is looking for it.</p>
      </div>

      <div className="promise">
        <img src="/logo.svg" alt="Flare" />
        <h1>Offer what you do.<br />Sell what you make.<br />Get paid.</h1>
        <p>Flare connects people around the world who offer services and products with the people ready to pay for them.</p>
        <Btn icon={Icon.arrow} onClick={onDone}>Get started</Btn>
      </div>
    </div>
  );
}
