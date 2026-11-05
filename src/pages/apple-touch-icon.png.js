// The home-screen icon for iPhones and iPads (180 x 180), drawn from the SVG favicon at build time
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

export async function GET(){
  // From the project root: this file is bundled before it runs, so paths relative to it would point into dist
  const svg = await readFile(resolve("public/favicon.svg"));
  const png = await sharp(svg, { density: 300 }).resize(180, 180).png().toBuffer();
  return new Response(png, { headers: { "Content-Type": "image/png" } });
}
