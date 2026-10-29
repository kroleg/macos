// Builds the self-contained page the app shows: every layer drawn in both
// themes, tabs + ←/→ to switch, combos listed under the drawing.
// Usage: node page.ts > build/keymap.html

import { readFileSync } from "node:fs";
import { combosFor, drawLayer, legendText, THEMES, type Keymap, type PhysicalKey } from "./svg.ts";

// Keys not worth showing: outer columns, encoder press, arrow cross in the middle
const HIDDEN = new Set([0, 13, 28, 12, 27, 41, 34, 6, 19, 20, 21, 35]);
const RIGHT_HALF_X = 1000; // physical x where the right half starts
const GAP_CUT = 450; // pull the right half closer once the middle is gone
const THUMBS = new Set([42, 43, 44, 45, 46, 47]);
const THUMB_OUT = 63; // move thumb keys outward: inner thumbs end up 1/2 key apart

function trim(km: Keymap): Keymap {
  const keep = km.keys.map((_, i) => i).filter((i) => !HIDDEN.has(i));
  const index = new Map(keep.map((old, i) => [old, i]));
  const shift = (k: PhysicalKey, dx: number) => ({ ...k, x: k.x + dx, rx: k.r ? k.rx + dx : k.rx });
  let keys = keep.map((i) => {
    const k = km.keys[i];
    const right = k.x >= RIGHT_HALF_X;
    const thumb = THUMBS.has(i) ? (right ? THUMB_OUT : -THUMB_OUT) : 0;
    return shift(k, (right ? -GAP_CUT : 0) + thumb);
  });
  const minX = Math.min(...keys.map((k) => k.x));
  keys = keys.map((k) => shift(k, -minX));
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

const tabs = LAYERS.map((l, i) => `<button data-layer="${i}">${TITLES[l] ?? l}<kbd>${i + 1}</kbd></button>`).join("");
// preset window widths; height follows the drawing's aspect ratio
const SIZES: [string, number][] = [["S", 480], ["M", 760], ["L", 1100]];
const sizeButtons = SIZES.map(([name, w]) => `<button class="size" data-name="${name}" data-width="${w}">${name}</button>`).join("");

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
  body { border-radius: 0 0 var(--corner, 16px) var(--corner, 16px); }
  body.focused { box-shadow: inset 0 0 0 3px var(--accent); }
  nav { display: flex; gap: 4px; margin-bottom: 6px; }
  nav button { border: 0; border-radius: 6px; padding: 3px 10px; background: transparent; color: var(--sub); font: inherit; }
  nav button.active { background: var(--accent); color: var(--bg); font-weight: 600; }
  nav kbd { font: 10px -apple-system, sans-serif; opacity: 0.6; margin-left: 4px; }
  nav .sizes { margin-left: auto; display: flex; gap: 2px; }
  nav .size { padding: 3px 7px; }
  nav .size:hover { color: var(--text); }
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
<nav>${tabs}<span class="sizes">${sizeButtons}</span></nav>
${sections.join("\n")}
<script>
  const count = ${LAYERS.length};
  let current = 0;
  function show(i) {
    current = (i + count) % count;
    document.querySelectorAll("[data-layer]").forEach((el) => el.classList.toggle("active", +el.dataset.layer === current));
  }
  document.querySelectorAll("nav button[data-layer]").forEach((b) => (b.onclick = () => show(+b.dataset.layer)));
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowRight") show(current + 1);
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key >= "1" && e.key <= String(count)) show(+e.key - 1);
    // S/M/L size presets; in RU mode the same physical keys type в/р/г
    const size = { s: "S", "в": "S", m: "M", "р": "M", l: "L", "г": "L" }[e.key.toLowerCase()];
    if (size) document.querySelector('nav .size[data-name="' + size + '"]').click();
  });

  // S/M/L: ask the app for a window whose height fits the drawing at that width
  document.querySelectorAll("nav .size").forEach((b) => (b.onclick = () => {
    const width = +b.dataset.width;
    const section = document.querySelector("section.active");
    const box = section.querySelector("svg").viewBox.baseVal;
    const combos = section.querySelector(".combos");
    const pad = 16; // body padding, top + bottom
    const nav = document.querySelector("nav");
    const height = pad + nav.offsetHeight + 6 + (width - pad) * (box.height / box.width) + (combos ? combos.offsetHeight + 6 : 0);
    window.webkit.messageHandlers.resize.postMessage({ width, height: Math.round(height) });
  }));
  show(0);
</script>
</body>
</html>
`);
