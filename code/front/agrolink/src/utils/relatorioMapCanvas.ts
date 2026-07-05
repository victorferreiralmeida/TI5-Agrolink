import type { LatLng } from '../geo/fazendaMapGeometry';
import { corSetorMapa } from '../geo/fazendaMapGeometry';

export type FazendaPoligonoRelatorio = { nome: string; poly: LatLng[] };

export type SetorPoligonoRelatorio = { id: number; nome: string; poly: LatLng[] };

export type PontoOcorrenciaMapa = { lat: number; lng: number; categoria: string };

type BBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

/** Lado da área útil do mapa (quadrada), em pixels — maior = mais visível na UI e no PDF. */
const MAP_SQUARE = 1100;
const PAD_TOP = 28;
const GAP_MAP_LEGEND = 14;
const LEGEND_ZONE = 80;
const PAD_BOTTOM = 28;
/** Canvas final quadrada: mapa quadrado + faixa de legenda. */
const CANVAS = PAD_TOP + MAP_SQUARE + GAP_MAP_LEGEND + LEGEND_ZONE + PAD_BOTTOM;
const MAP_ORIGIN_X = Math.floor((CANVAS - MAP_SQUARE) / 2);
const SIDE_MARGIN = 40;
const MAX_TILES = 24;
const OSM_TILE = 'https://tile.openstreetmap.org';

/** Largura/altura do PNG exportado (quadrado). */
export const RELATORIO_MAPA_EXPORT_SIZE = CANVAS;

const CATEGORIA_COR: Record<string, string> = {
  INCENDIO: '#c62828',
  CERCA: '#ef6c00',
  PRAGA: '#6a1b9a',
  MANUTENCAO: '#1565c0',
  INFRAESTRUTURA: '#00838f',
  SOLO: '#558b2f',
};

function corCategoria(cat: string): string {
  const k = cat.trim().toUpperCase();
  return CATEGORIA_COR[k] ?? '#1565c0';
}

function extendBBox(b: BBox | null, lat: number, lng: number): BBox {
  if (!b) return { minLat: lat, maxLat: lat, minLng: lng, maxLng: lng };
  return {
    minLat: Math.min(b.minLat, lat),
    maxLat: Math.max(b.maxLat, lat),
    minLng: Math.min(b.minLng, lng),
    maxLng: Math.max(b.maxLng, lng),
  };
}

function bboxFromRings(rings: LatLng[][]): BBox | null {
  let b: BBox | null = null;
  for (const ring of rings) {
    for (const [lat, lng] of ring) {
      if (Number.isFinite(lat) && Number.isFinite(lng)) b = extendBBox(b, lat, lng);
    }
  }
  return b;
}

function padBBox(b: BBox, padRatio = 0.08): BBox {
  let dLat = b.maxLat - b.minLat;
  let dLng = b.maxLng - b.minLng;
  if (dLat < 1e-6) dLat = 0.002;
  if (dLng < 1e-6) dLng = 0.002;
  const m = Math.max(dLat, dLng) * padRatio;
  return {
    minLat: b.minLat - m,
    maxLat: b.maxLat + m,
    minLng: b.minLng - m,
    maxLng: b.maxLng + m,
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 6) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  return [21, 101, 52];
}

/** Web Mercator: pixel top-left of world at zoom z (same convention as OSM raster tiles). */
function worldPixel(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = Math.pow(2, z);
  const mapSize = 256 * n;
  const x = ((lng + 180) / 360) * mapSize;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * mapSize;
  return { x, y };
}

function tileRangeForBox(box: BBox, z: number) {
  const corners: LatLng[] = [
    [box.minLat, box.minLng],
    [box.minLat, box.maxLng],
    [box.maxLat, box.minLng],
    [box.maxLat, box.maxLng],
  ];
  let minTx = Infinity;
  let maxTx = -Infinity;
  let minTy = Infinity;
  let maxTy = -Infinity;
  for (const [la, ln] of corners) {
    const { x, y } = worldPixel(la, ln, z);
    const tx = Math.floor(x / 256);
    const ty = Math.floor(y / 256);
    minTx = Math.min(minTx, tx);
    maxTx = Math.max(maxTx, tx);
    minTy = Math.min(minTy, ty);
    maxTy = Math.max(maxTy, ty);
  }
  return {
    minTx,
    maxTx,
    minTy,
    maxTy,
    nx: maxTx - minTx + 1,
    ny: maxTy - minTy + 1,
  };
}

function chooseZoom(box: BBox): number {
  let bestZ = 6;
  for (let z = 6; z <= 18; z++) {
    const r = tileRangeForBox(box, z);
    if (r.nx * r.ny > MAX_TILES) break;
    bestZ = z;
  }
  return bestZ;
}

function loadOsmTile(z: number, tx: number, ty: number, ms: number): Promise<HTMLImageElement> {
  const url = `${OSM_TILE}/${z}/${tx}/${ty}.png`;
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('timeout')), ms);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      window.clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      reject(new Error('tile'));
    };
    img.src = url;
  });
}

function prepareMapContext(input: {
  fazendas: FazendaPoligonoRelatorio[];
  setores: SetorPoligonoRelatorio[];
  ocorrencias: PontoOcorrenciaMapa[];
}) {
  const farmRings = input.fazendas.map((f) => f.poly).filter((p) => p.length >= 3);
  const occPoints = input.ocorrencias.filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lng));

  const ringsForBbox: LatLng[][] = [
    ...farmRings,
    ...input.setores.map((s) => s.poly).filter((p) => p.length >= 3),
    ...occPoints.map((o) => [[o.lat, o.lng]] as LatLng[]),
  ];

  const raw = bboxFromRings(ringsForBbox);
  if (!raw) return null;
  const box = padBBox(raw);
  return { farmRings, occPoints, box, input };
}

function drawLegendAndAttribution(ctx: CanvasRenderingContext2D, basemap: 'osm' | 'none', legendY: number) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '10px system-ui, Segoe UI, sans-serif';
  ctx.fillStyle = '#37474f';
  ctx.fillText('Legenda:', SIDE_MARGIN, legendY);
  let lx = SIDE_MARGIN + 52;
  ctx.fillStyle = '#1f6b3a';
  ctx.fillRect(lx, legendY - 5, 14, 10);
  ctx.strokeStyle = '#1f6b3a';
  ctx.strokeRect(lx, legendY - 5, 14, 10);
  lx += 22;
  ctx.fillStyle = '#37474f';
  ctx.fillText('Perímetro da fazenda', lx, legendY);
  lx += 118;
  ctx.fillStyle = '#7b3fa3';
  ctx.fillRect(lx, legendY - 5, 14, 10);
  lx += 22;
  ctx.fillText('Setores', lx, legendY);
  lx += 72;
  ctx.fillStyle = '#c62828';
  ctx.beginPath();
  ctx.arc(lx + 7, legendY, 5, 0, Math.PI * 2);
  ctx.fill();
  lx += 20;
  ctx.fillStyle = '#37474f';
  ctx.fillText('Ocorrências', lx, legendY);

  if (basemap === 'osm') {
    ctx.font = '9px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = '#78909c';
    ctx.textAlign = 'right';
    ctx.fillText('© OpenStreetMap contributors', CANVAS - SIDE_MARGIN, legendY + 14);
    ctx.textAlign = 'left';
  }
}

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  project: (lat: number, lng: number) => [number, number],
  farmRings: LatLng[][],
  setores: SetorPoligonoRelatorio[],
  occPoints: PontoOcorrenciaMapa[],
) {
  const drawPolygon = (poly: LatLng[], fillStyle: string | undefined, strokeStyle: string, lineWidth: number) => {
    if (poly.length < 2) return;
    ctx.beginPath();
    for (let i = 0; i < poly.length; i++) {
      const [la, ln] = poly[i]!;
      const [x, y] = project(la, ln);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  for (const ring of farmRings) {
    drawPolygon(ring, 'rgba(31, 107, 58, 0.18)', '#ffffff', 4);
    drawPolygon(ring, 'rgba(31, 107, 58, 0.12)', '#1f6b3a', 2.5);
  }

  for (const s of setores) {
    if (s.poly.length < 3) continue;
    const stroke = corSetorMapa(s.id);
    const [r, g, b] = hexToRgb(stroke);
    drawPolygon(s.poly, `rgba(${r},${g},${b},0.2)`, stroke, 2);
    let sx = 0;
    let sy = 0;
    for (const [la, ln] of s.poly) {
      const [x, y] = project(la, ln);
      sx += x;
      sy += y;
    }
    const n = s.poly.length;
    const cx = sx / n;
    const cy = sy / n;
    const label = s.nome.length > 22 ? `${s.nome.slice(0, 20)}…` : s.nome;
    ctx.font = '600 11px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = '#263238';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, cx, cy);
    ctx.fillText(label, cx, cy);
  }

  for (const o of occPoints) {
    const [x, y] = project(o.lat, o.lng);
    const col = corCategoria(o.categoria);
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/**
 * Mapa apenas com fundo neutro (fallback se tiles não carregarem).
 */
export function buildRelatorioMapPng(input: {
  fazendas: FazendaPoligonoRelatorio[];
  setores: SetorPoligonoRelatorio[];
  ocorrencias: PontoOcorrenciaMapa[];
}): string | null {
  const prep = prepareMapContext(input);
  if (!prep) return null;
  const { farmRings, occPoints, box, input: inp } = prep;

  const project = (lat: number, lng: number): [number, number] => {
    const slat = box.maxLat - box.minLat || 1e-9;
    const slng = box.maxLng - box.minLng || 1e-9;
    const x = MAP_ORIGIN_X + ((lng - box.minLng) / slng) * MAP_SQUARE;
    const y = PAD_TOP + ((box.maxLat - lat) / slat) * MAP_SQUARE;
    return [x, y];
  };

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS;
  canvas.height = CANVAS;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#f4f7f5';
  ctx.fillRect(0, 0, CANVAS, CANVAS);
  ctx.strokeStyle = '#cfd8dc';
  ctx.strokeRect(MAP_ORIGIN_X - 0.5, PAD_TOP - 0.5, MAP_SQUARE + 1, MAP_SQUARE + 1);

  drawOverlays(ctx, project, farmRings, inp.setores, occPoints);

  const legendY = PAD_TOP + MAP_SQUARE + GAP_MAP_LEGEND + 22;
  drawLegendAndAttribution(ctx, 'none', legendY);

  return canvas.toDataURL('image/png');
}

/**
 * Mapa com fundo de tiles OpenStreetMap (ruas) + contornos e ocorrências.
 * Se o carregamento dos tiles falhar (rede/CORS), usa o mesmo desenho do {@link buildRelatorioMapPng}.
 */
export async function buildRelatorioMapPngAsync(input: {
  fazendas: FazendaPoligonoRelatorio[];
  setores: SetorPoligonoRelatorio[];
  ocorrencias: PontoOcorrenciaMapa[];
}): Promise<string | null> {
  const prep = prepareMapContext(input);
  if (!prep) return null;
  const { farmRings, occPoints, box, input: inp } = prep;

  const z = chooseZoom(box);
  const { minTx, maxTx, minTy, maxTy, nx, ny } = tileRangeForBox(box, z);
  const sw = nx * 256;
  const sh = ny * 256;

  const stitched = document.createElement('canvas');
  stitched.width = sw;
  stitched.height = sh;
  const sctx = stitched.getContext('2d');
  if (!sctx) return buildRelatorioMapPng(input);

  try {
    type Job = { tx: number; ty: number; dx: number; dy: number };
    const jobs: Job[] = [];
    for (let ix = 0; ix < nx; ix++) {
      for (let iy = 0; iy < ny; iy++) {
        const tx = minTx + ix;
        const ty = minTy + iy;
        jobs.push({ tx, ty, dx: ix * 256, dy: iy * 256 });
      }
    }
    const concurrency = 5;
    for (let i = 0; i < jobs.length; i += concurrency) {
      const chunk = jobs.slice(i, i + concurrency);
      const loaded = await Promise.all(
        chunk.map((j) => loadOsmTile(z, j.tx, j.ty, 9000).then((img) => ({ img, dx: j.dx, dy: j.dy }))),
      );
      for (const { img, dx, dy } of loaded) {
        sctx.drawImage(img, dx, dy);
      }
    }
  } catch {
    return buildRelatorioMapPng(input);
  }

  const originX = minTx * 256;
  const originY = minTy * 256;
  const projectStitched = (lat: number, lng: number): [number, number] => {
    const { x, y } = worldPixel(lat, lng, z);
    return [x - originX, y - originY];
  };

  drawOverlays(sctx, projectStitched, farmRings, inp.setores, occPoints);

  const scale = Math.min(MAP_SQUARE / sw, MAP_SQUARE / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const ox = MAP_ORIGIN_X + (MAP_SQUARE - dw) / 2;
  const oy = PAD_TOP + (MAP_SQUARE - dh) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS;
  canvas.height = CANVAS;
  const ctx = canvas.getContext('2d');
  if (!ctx) return buildRelatorioMapPng(input);

  ctx.fillStyle = '#eceff1';
  ctx.fillRect(0, 0, CANVAS, CANVAS);
  ctx.strokeStyle = '#b0bec5';
  ctx.strokeRect(MAP_ORIGIN_X - 0.5, PAD_TOP - 0.5, MAP_SQUARE + 1, MAP_SQUARE + 1);
  ctx.drawImage(stitched, ox, oy, dw, dh);

  const legendY = PAD_TOP + MAP_SQUARE + GAP_MAP_LEGEND + 22;
  drawLegendAndAttribution(ctx, 'osm', legendY);

  return canvas.toDataURL('image/png');
}
