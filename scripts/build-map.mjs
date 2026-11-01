// Regenerates the static map data used by the Hometowns panel:
//   map-land.json   one SVG path of the world's land (Natural Earth 110m, public domain)
//   hometowns.json  place name -> [x, y] in the same coordinates, for the places in info.json
// Run by hand when artists are added: node scripts/build-map.mjs
import { readFile, writeFile } from "node:fs/promises";

const WIDTH = 1000;
const HEIGHT = 500;
const round = (n) => Math.round(n * 10) / 10;
// Equirectangular: simple, and pins line up with the land path without a map library
const project = (lon, lat) => [round(((lon + 180) / 360) * WIDTH), round(((90 - lat) / 180) * HEIGHT)];

async function buildLand() {
  const res = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json");
  if (!res.ok) throw new Error(`world-atlas: ${res.status}`);
  const topo = await res.json();
  const { scale, translate } = topo.transform;
  // Topojson arcs are delta-encoded
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
  const ring = (ids) => ids.flatMap((id) => {
    if (id >= 0) return arcs[id];
    return [...arcs[~id]].reverse();
  });
  const land = topo.objects.land;
  let geoms = [land];
  if (land.type === "GeometryCollection") geoms = land.geometries;
  const paths = [];
  for (const g of geoms) {
    let polys = [g.arcs];
    if (g.type === "MultiPolygon") polys = g.arcs;
    for (const poly of polys) for (const r of poly) {
      const pts = ring(r).map(([lon, lat]) => project(lon, lat).join(","));
      paths.push("M" + pts.join("L") + "Z");
    }
  }
  return { width: WIDTH, height: HEIGHT, path: paths.join("") };
}

// Coordinates of where each artist formed (or was born), from Wikidata
async function buildHometowns() {
  const info = JSON.parse(await readFile("public/info.json", "utf8"));
  const artists = Object.values(info.artists).filter((a) => a?.qid && (a.formed_in || a.birthplace));
  const out = {};
  for (let i = 0; i < artists.length; i += 50) {
    const chunk = artists.slice(i, i + 50);
    const query = `SELECT ?item ?coord WHERE { VALUES ?item { ${chunk.map((a) => "wd:" + a.qid).join(" ")} }
      ?item wdt:P740|wdt:P19 ?place. ?place wdt:P625 ?coord. }`;
    const res = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query), {
      headers: { accept: "application/sparql-results+json", "user-agent": "show-log-map-builder/1.0" },
    });
    if (!res.ok) throw new Error(`wikidata: ${res.status}`);
    const { results } = await res.json();
    const byQid = new Map();
    for (const b of results.bindings) {
      const qid = b.item.value.split("/").pop();
      if (!byQid.has(qid)) byQid.set(qid, b.coord.value);
    }
    for (const a of chunk) {
      const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(byQid.get(a.qid) || "");
      if (!m) continue;
      const place = a.formed_in || a.birthplace;
      if (!out[place]) out[place] = project(+m[1], +m[2]);
    }
  }
  return out;
}

const land = await buildLand();
const hometowns = await buildHometowns();
await writeFile("public/map-land.json", JSON.stringify(land));
await writeFile("public/hometowns.json", JSON.stringify(hometowns, null, 0));
console.log(`land path ${land.path.length} chars, ${Object.keys(hometowns).length} places`);
