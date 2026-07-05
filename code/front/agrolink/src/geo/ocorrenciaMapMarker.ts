import L from 'leaflet';
import {
  prioridadeOcorrencia,
  statusOcorrencia,
  type OcorrenciaDto,
} from '../api/ocorrenciasApi';

/** Mesmos tipos visuais do app mobile (`mapa_screen.dart`). */
export type TipoMarcadorOcorrencia = 'critico' | 'alerta' | 'emCurso' | 'resolvido';

const MARCADOR_CFG: Record<
  TipoMarcadorOcorrencia,
  { color: string; filled: boolean; icon: 'warning' | 'warning_amber' | 'schedule' | 'check' }
> = {
  critico: { color: '#D32F2F', filled: true, icon: 'warning' },
  alerta: { color: '#FF6F00', filled: false, icon: 'warning_amber' },
  emCurso: { color: '#424242', filled: false, icon: 'schedule' },
  resolvido: { color: '#224F2F', filled: false, icon: 'check' },
};

const SVG_PATH: Record<typeof MARCADOR_CFG.critico.icon, string> = {
  warning:
    'M12 2L2 20h20L12 2zm0 13.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm0-6.25a1.1 1.1 0 00-1.1 1.1v3.4a1.1 1.1 0 002.2 0v-3.4a1.1 1.1 0 00-1.1-1.1z',
  warning_amber:
    'M12 2L2 20h20L12 2zm0 13.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm0-6.25a1.1 1.1 0 00-1.1 1.1v3.4a1.1 1.1 0 002.2 0v-3.4a1.1 1.1 0 00-1.1-1.1z',
  schedule:
    'M12 2a10 10 0 1010 10A10.01 10.01 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8zm.75-12h-1.5v5.1l4.35 2.55.75-1.25-3.6-2.1V8z',
  check:
    'M12 2a10 10 0 1010 10A10.01 10.01 0 0012 2zm-1.3 14.2l-5.2-5.2 1.4-1.4 3.8 3.8 7.6-7.6 1.4 1.4-9 9z',
};

export function tipoMarcadorOcorrencia(input: {
  status?: string | null;
  prioridade?: string | null;
}): TipoMarcadorOcorrencia {
  if (statusOcorrencia(input.status) === 'RESOLVIDA') return 'resolvido';
  const p = prioridadeOcorrencia(input.prioridade);
  if (p === 'URGENTE') return 'critico';
  if (p === 'ALTA' || p === 'MEDIA') return 'alerta';
  return 'emCurso';
}

export function tipoMarcadorOcorrenciaFromDto(o: Pick<OcorrenciaDto, 'status' | 'prioridade'>): TipoMarcadorOcorrencia {
  return tipoMarcadorOcorrencia({ status: o.status, prioridade: o.prioridade });
}

/** Ícone Leaflet alinhado ao marcador do mobile (40px + haste 8px). */
export function buildOcorrenciaMarkerIcon(tipo: TipoMarcadorOcorrencia): L.DivIcon {
  const cfg = MARCADOR_CFG[tipo];
  const iconColor = cfg.filled ? '#ffffff' : cfg.color;

  const html = `
    <div class="occ-map-marker" data-tipo="${tipo}" aria-hidden="true">
      <div
        class="occ-map-marker__badge${cfg.filled ? ' is-filled' : ''}"
        style="--occ-color:${cfg.color}"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" focusable="false" aria-hidden="true">
          <path fill="${iconColor}" d="${SVG_PATH[cfg.icon]}"/>
        </svg>
      </div>
      <div class="occ-map-marker__stem" style="--occ-color:${cfg.color}"></div>
    </div>
  `.trim();

  return L.divIcon({
    className: 'occ-map-marker-wrapper',
    html,
    iconSize: [44, 52],
    iconAnchor: [22, 52],
    popupAnchor: [0, -52],
  });
}

/** Legenda (dashboard / mapa). */
export const LEGENDA_MARCADORES_OCORRENCIA: ReadonlyArray<{
  tipo: TipoMarcadorOcorrencia;
  label: string;
}> = [
  { tipo: 'critico', label: 'Crítico' },
  { tipo: 'alerta', label: 'Alerta' },
  { tipo: 'emCurso', label: 'Em andamento' },
  { tipo: 'resolvido', label: 'Resolvido' },
];
