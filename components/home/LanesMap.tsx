import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-50m.json';

// Rendered on the server: real country outlines, pins and London routes as static SVG.
const W = 640, H = 520;
const UK: Record<string, [number, number]> = { London: [-0.13, 51.51], Manchester: [-2.24, 53.48], Birmingham: [-1.89, 52.49], Leeds: [-1.55, 53.8] };
const EU: Record<string, [number, number]> = { Berlin: [13.4, 52.52], Frankfurt: [8.68, 50.11], Hamburg: [9.99, 53.55], Paris: [2.35, 48.86], Lyon: [4.84, 45.76], Amsterdam: [4.9, 52.37], Rotterdam: [4.48, 51.92] };
const SERVED = new Set(['826', '250', '276', '528']); // UK, France, Germany, Netherlands

export function LanesMap() {
  const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
  const countries = feature(topo, topo.objects.countries).features;
  const proj = geoMercator()
    .fitExtent([[10, 10], [W - 10, H - 10]], { type: 'MultiPoint', coordinates: [[-7, 58.5], [15.5, 44.5]] })
    .clipExtent([[0, 0], [W, H]]);
  const path = geoPath(proj);
  const at = (ll: [number, number]) => proj(ll) ?? [0, 0];
  const [lx, ly] = at(UK.London);

  return (
    <svg id="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Map of lanes from London, Manchester, Birmingham and Leeds to Berlin, Frankfurt, Hamburg, Paris, Lyon, Amsterdam and Rotterdam">
      <g>
        {countries.map((f, i) => {
          const d = path(f);
          return d ? <path key={i} d={d} className={SERVED.has(String(f.id)) ? 'land on' : 'land'} /> : null;
        })}
      </g>
      <g id="routes">
        {Object.values(EU).map((ll, i) => {
          const [x, y] = at(ll);
          return <path key={i} className="route" d={`M${lx} ${ly} Q ${(lx + x) / 2} ${Math.min(ly, y) - 60} ${x} ${y}`} />;
        })}
      </g>
      <g>
        {Object.entries({ ...UK, ...EU }).map(([name, ll]) => {
          const [x, y] = at(ll);
          const uk = name in UK;
          return (
            <g key={name}>
              <circle cx={x} cy={y} r={uk ? 5 : 6} fill={uk ? '#0b1733' : '#c41f2e'} stroke="#fff" strokeWidth="2" />
              {(!uk || name === 'London') && <text x={x + 9} y={y + 4}>{name}</text>}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
