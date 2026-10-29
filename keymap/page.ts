// Builds the self-contained page the app shows: every layer drawn in both
// themes, tabs + ←/→ to switch, combos listed under the drawing.
// Usage: node page.ts > build/keymap.html

import { readFileSync } from "node:fs";
import { combosFor, drawLayer, legendText, THEMES, type Keymap } from "./svg.ts";

// Keys not worth showing: outer columns, encoder press, arrow cross in the middle
const HIDDEN = new Set([0, 13, 28, 12, 27, 41, 34, 6, 19, 20, 21, 35]);
const RIGHT_HALF_X = 1000; // physical x where the right half starts
const GAP_CUT = 300; // pull the right half closer once the middle is gone

function trim(km: Keymap): Keymap {
  const keep = km.keys.map((_, i) => i).filter((i) => !HIDDEN.has(i));
  const index = new Map(keep.map((old, i) => [old, i]));
  let keys = keep.map((i) => {
    const k = km.keys[i];
    if (k.x < RIGHT_HALF_X) return k;
    return { ...k, x: k.x - GAP_CUT, rx: k.r ? k.rx - GAP_CUT : k.rx };
  });
  const minX = Math.min(...keys.map((k) => k.x));
  keys = keys.map((k) => ({ ...k, x: k.x - minX, rx: k.r ? k.rx - minX : k.rx }));
  return {
    keys,
    layers: Object.fromEntries(Object.entries(km.layers).map(([name, b]) => [name, keep.map((i) => b[i])])),
    combos: (km.combos ?? [])
      .filter((c) => c.p.every((p) => index.has(p)))
      .map((c) => ({ ...c, p: c.p.map((p) => index.get(p)!) })),
  };
}

const keymap = trim(JSON.parse(readFileSync(new URL("keymap.json", import.meta.url), "utf8")));

// RU first; names are the layers' display-name in the ZMK keymap
const LAYERS = ["QWERTY", "RU SYM", "COLEMAK", "SYM", "NAVI", "HIGH"].filter((l) => l in keymap.layers);
const TITLES: Record<string, string> = { QWERTY: "RU", COLEMAK: "EN" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const sections = LAYERS.map((layer, i) => {
  const combos = combosFor(keymap, layer).map(
    (c) => `<li>${c.p.map((p) => esc(legendText(keymap.layers[layer][p]))).join(" + ")} → <b>${esc(legendText(c.k))}</b></li>`,
  );
  return `<section data-layer="${i}">
<div class="light">${drawLayer(keymap, layer, THEMES.light)}</div>
<div class="dark">${drawLayer(keymap, layer, THEMES.dark)}</div>
${combos.length ? `<ul class="combos">${combos.join("")}</ul>` : ""}
</section>`;
});

const tabs = LAYERS.map((l, i) => `<button data-layer="${i}">${TITLES[l] ?? l}</button>`).join("");

process.stdout.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root { color-scheme: light dark; --bg: ${THEMES.light.bg}; --text: ${THEMES.light.text}; --sub: ${THEMES.light.sub}; --accent: ${THEMES.light.combo}; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: ${THEMES.dark.bg}; --text: ${THEMES.dark.text}; --sub: ${THEMES.dark.sub}; --accent: ${THEMES.dark.combo}; }
  }
  /* the drawing scales to fit the window both ways */
  html, body { height: 100%; }
  body { margin: 0; padding: 8px; box-sizing: border-box; display: flex; flex-direction: column; background: var(--bg); color: var(--text); font: 13px -apple-system, sans-serif; -webkit-user-select: none; cursor: default; }
  nav { display: flex; gap: 4px; margin-bottom: 6px; }
  nav button { border: 0; border-radius: 6px; padding: 3px 10px; background: transparent; color: var(--sub); font: inherit; }
  nav button.active { background: var(--accent); color: var(--bg); font-weight: 600; }
  section { display: none; }
  section.active { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .light, .dark { flex: 1; min-height: 0; }
  svg { width: 100%; height: 100%; display: block; }
  .dark { display: none; }
  @media (prefers-color-scheme: dark) { .light { display: none; } .dark { display: block; } }
  .combos { margin: 6px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 4px 16px; color: var(--sub); }
  .combos b { color: var(--accent); }
</style>
</head>
<body>
<nav>${tabs}</nav>
${sections.join("\n")}
<script>
  const count = ${LAYERS.length};
  let current = 0;
  function show(i) {
    current = (i + count) % count;
    document.querySelectorAll("[data-layer]").forEach((el) => el.classList.toggle("active", +el.dataset.layer === current));
  }
  document.querySelectorAll("nav button").forEach((b) => (b.onclick = () => show(+b.dataset.layer)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") show(current + 1);
    if (e.key === "ArrowLeft") show(current - 1);
  });
  show(0);
</script>
</body>
</html>
`);
