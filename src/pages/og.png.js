// The share image for link previews: 1200 x 630, drawn at build time from the live totals (src/lib/site-data.mjs).
// Satori lays it out and draws the text as shapes from the font files in src/og/fonts, so it doesn't depend on
// fonts installed on the build machine; sharp turns that SVG into a PNG.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import satori from "satori";
import sharp from "sharp";
import { siteData } from "../lib/site-data.mjs";

// From the project root: this file is bundled before it runs, so paths relative to it would point into dist
const font = name => readFile(resolve("src/og/fonts", name));

// The site's navy scheme, and the ticket's light paper
const C = { bg: "#0b1430", paper: "#e8ebf1", ink: "#121526", muted: "#454b62", line: "#c2c8d6", gold: "#f2c14e" };

// A tiny element helper: satori takes React-style {type, props} objects
const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.flat() } });

// One total; the ones after the first get a divider on their left, like the header ticket
function stat(value, label, first){
  const box = { flexDirection: "column", gap: 6, paddingRight: 34, paddingLeft: 34, borderLeft: `2px solid ${C.line}` };
  if (first) { box.paddingLeft = 0; box.borderLeft = "none"; }
  return h("div", box,
    h("div", { fontFamily: "Display", fontSize: 64, lineHeight: 1, color: C.ink }, String(value)),
    h("div", { fontFamily: "Mono", fontSize: 18, letterSpacing: 3, color: C.muted }, label.toUpperCase()));
}

// One half-circle bite where the stub tears off
function notch(edge){
  return h("div", { position: "absolute", right: -22, [edge]: -22, width: 44, height: 44, borderRadius: 22, background: C.bg });
}

export async function GET(){
  const { totals, span } = await siteData();
  let stampText = "STAMPED";
  if (span) stampText = span;
  const tree = h("div", { width: 1200, height: 630, background: C.bg, alignItems: "center", justifyContent: "center" },
    h("div", { width: 1060, height: 420, borderRadius: 20, overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,.45)" },
      // The ticket's face
      h("div", { position: "relative", flex: 1, flexDirection: "column", justifyContent: "center", gap: 26, padding: "0 56px", background: C.paper, borderRight: `4px dashed ${C.line}` },
        notch("top"), notch("bottom"),
        h("div", { fontFamily: "Mono", fontSize: 20, letterSpacing: 5, color: C.muted }, "CORY'S CONCERT & STAND-UP"),
        h("div", { fontFamily: "Display", fontSize: 150, lineHeight: 0.85, color: C.ink, marginTop: -6 }, "SHOW LOG"),
        h("div", { marginTop: 8 }, stat(totals.artists, "Artists", true), stat(totals.venues, "Venues"), stat(totals.cities, "Cities")),
      ),
      // The stub
      h("div", { position: "relative", width: 290, flexDirection: "column", justifyContent: "center", padding: "0 40px", background: C.ink, color: C.paper },
        h("div", { fontFamily: "Mono", fontSize: 20, letterSpacing: 5, opacity: 0.6 }, "NO."),
        h("div", { fontFamily: "Display", fontSize: 168, lineHeight: 0.85, color: C.gold }, String(totals.nights)),
        h("div", { fontFamily: "Mono", fontSize: 20, letterSpacing: 4, opacity: 0.8, marginTop: 10 }, "NIGHTS OUT"),
        // The rubber stamp: the years, tilted, in gold, at the foot of the stub
        h("div", {
          position: "absolute", left: 36, bottom: 30, padding: "6px 14px 2px", border: `4px solid ${C.gold}`, borderRadius: 8,
          fontFamily: "Display", fontSize: 30, letterSpacing: 2, color: C.gold, transform: "rotate(-7deg)", opacity: 0.8,
        }, stampText),
      ),
    ),
  );
  const svg = await satori(tree, {
    width: 1200, height: 630,
    fonts: [
      { name: "Display", data: await font("BigShouldersDisplay-ExtraBold.ttf"), weight: 800, style: "normal" },
      { name: "Mono", data: await font("IBMPlexMono-Medium.ttf"), weight: 500, style: "normal" },
    ],
  });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(png, { headers: { "Content-Type": "image/png" } });
}
