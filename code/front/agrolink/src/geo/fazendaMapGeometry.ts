import L from 'leaflet';

export type LatLng = [number, number];

/** Paleta fixa por setor: cor = CORES_SETOR_MAPA[Math.abs(id) % length]. */
export const CORES_SETOR_MAPA = [
  '#c26b00',
  '#1f6b3a',
  '#114f9f',
  '#7b3fa3',
  '#b02222',
  '#00838f',
  '#c2185b',
  '#5d4037',
  '#f9a825',
  '#3949ab',
  '#00796b',
  '#6a1b9a',
  '#e65100',
  '#2e7d32',
  '#0277bd',
  '#8e24aa',
  '#d32f2f',
  '#00695c',
  '#ad1457',
  '#4e342e',
  '#fbc02d',
  '#303f9f',
  '#00897b',
  '#4527a0',
] as const;

export const QTD_CORES_SETOR_MAPA = CORES_SETOR_MAPA.length;

export function parsePolygonLatLng(raw: string | null | undefined): LatLng[] {
  if (!raw?.trim()) return [];
  try {
    const j = JSON.parse(raw) as { type?: string; coordinates?: unknown };
    if (j.type !== 'Polygon' || !Array.isArray(j.coordinates) || j.coordinates.length === 0) return [];
    const firstRing = j.coordinates[0];
    if (!Array.isArray(firstRing)) return [];
    const out: LatLng[] = [];
    for (const item of firstRing) {
      if (!Array.isArray(item) || item.length < 2) continue;
      const lng = Number(item[0]);
      const lat = Number(item[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
    }
    if (out.length >= 2) {
      const [a0, a1] = out[0]!;
      const [b0, b1] = out[out.length - 1]!;
      if (a0 === b0 && a1 === b1) out.pop();
    }
    return out;
  } catch {
    return [];
  }
}

export function boundsFromRings(rings: LatLng[][]): L.LatLngBounds | null {
  const valid = rings.filter((r) => r.length >= 1);
  if (valid.length === 0) return null;
  let b = L.latLngBounds(valid[0]![0]!, valid[0]![0]!);
  for (const ring of valid) {
    for (const pt of ring) {
      b = b.extend(pt);
    }
  }
  return b.isValid() ? b : null;
}

export function corSetorMapa(id: number): string {
  return CORES_SETOR_MAPA[Math.abs(id) % CORES_SETOR_MAPA.length]!;
}
