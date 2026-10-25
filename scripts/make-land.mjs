// Generates lib/data/landDots.json: evenly spaced (Fibonacci) points that fall on land.
// Used by the hero globe. Run: node scripts/make-land.mjs
import fs from 'fs';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/land-110m.json', 'utf8'));
const land = feature(topo, topo.objects.land);
const N = 42000, out = [];
const ga = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2;
  const lat = (Math.asin(y) * 180) / Math.PI;
  const lon = ((((i * ga * 180) / Math.PI) + 180) % 360) - 180;
  if (lat < -58) continue; // skip Antarctica
  if (geoContains(land, [lon, lat])) out.push(+lat.toFixed(1), +lon.toFixed(1));
}
fs.mkdirSync('lib/data', { recursive: true });
fs.writeFileSync('lib/data/landDots.json', JSON.stringify(out));
console.log(`${out.length / 2} land points, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
