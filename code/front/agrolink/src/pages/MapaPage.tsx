import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';

type Categoria = 'INCENDIO' | 'CERCA' | 'PRAGA' | 'MANUTENCAO';
type Filtro = 'TODAS' | 'CULTIVOS' | 'ALERTAS';

type OcorrenciaMapa = {
  id: number;
  titulo: string;
  setor: string;
  categoria: Categoria;
  coords: [number, number];
  horario: string;
};

const CATEGORIA_COR: Record<Categoria, string> = {
  INCENDIO: '#e53935',
  CERCA: '#fb8c00',
  PRAGA: '#8e24aa',
  MANUTENCAO: '#1e88e5',
};

const CATEGORIA_LABEL: Record<Categoria, string> = {
  INCENDIO: 'Incêndio',
  CERCA: 'Cerca rompida',
  PRAGA: 'Praga',
  MANUTENCAO: 'Manutenção',
};

const CENTRO_FAZENDA: LatLngExpression = [-21.1775, -47.8103];

const OCORRENCIAS_MAPA: OcorrenciaMapa[] = [
  {
    id: 1,
    titulo: 'Foco de incêndio',
    setor: 'Setor Norte',
    categoria: 'INCENDIO',
    coords: [-21.1738, -47.8121],
    horario: 'há 12 min',
  },
  {
    id: 2,
    titulo: 'Cerca rompida',
    setor: 'Divisa Leste',
    categoria: 'CERCA',
    coords: [-21.1782, -47.8045],
    horario: 'há 34 min',
  },
  {
    id: 3,
    titulo: 'Praga identificada',
    setor: 'Talhão 3',
    categoria: 'PRAGA',
    coords: [-21.1812, -47.8138],
    horario: 'há 1 h',
  },
  {
    id: 4,
    titulo: 'Manutenção pivô artesiano',
    setor: 'Setor Central',
    categoria: 'MANUTENCAO',
    coords: [-21.1760, -47.8085],
    horario: 'há 2 h',
  },
  {
    id: 5,
    titulo: 'Animal fora do perímetro',
    setor: 'Setor Sul',
    categoria: 'CERCA',
    coords: [-21.1830, -47.8072],
    horario: 'há 3 h',
  },
];

function buildMarkerIcon(cor: string) {
  const html = `
    <span class="map-pin" style="--pin-color:${cor}">
      <span class="map-pin__ring"></span>
      <span class="map-pin__dot"></span>
    </span>
  `;
  return L.divIcon({
    className: 'map-pin-wrapper',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function FlyToFocus({ target }: { target: LatLngExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 16, { duration: 0.9 });
    }
  }, [map, target]);
  return null;
}

function matchesFiltro(o: OcorrenciaMapa, filtro: Filtro) {
  if (filtro === 'TODAS') return true;
  if (filtro === 'CULTIVOS') return o.categoria === 'PRAGA' || o.categoria === 'MANUTENCAO';
  return o.categoria === 'INCENDIO' || o.categoria === 'CERCA';
}

export function MapaPage() {
  const location = useLocation();
  const focusId = (location.state as { focusId?: number } | null)?.focusId ?? null;

  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<number | null>(focusId);
  const markerRefs = useRef<Record<number, L.Marker | null>>({});

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return OCORRENCIAS_MAPA.filter((o) => {
      if (!matchesFiltro(o, filtro)) return false;
      if (!termo) return true;
      return (
        o.titulo.toLowerCase().includes(termo) ||
        o.setor.toLowerCase().includes(termo) ||
        CATEGORIA_LABEL[o.categoria].toLowerCase().includes(termo)
      );
    });
  }, [filtro, busca]);

  const focalizada = useMemo(
    () => OCORRENCIAS_MAPA.find((o) => o.id === selecionada) ?? null,
    [selecionada],
  );

  useEffect(() => {
    if (focalizada) {
      const m = markerRefs.current[focalizada.id];
      if (m) {
        m.openPopup();
      }
    }
  }, [focalizada]);

  return (
    <main className="mapa-main">
      <section className="mapa-toolbar">
        <div className="mapa-search">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M20 20l-3.2-3.2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <input
            type="search"
            placeholder="Pesquisar ocorrências, pessoas..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="mapa-tabs" role="tablist" aria-label="Filtros de ocorrências">
          {(['TODAS', 'CULTIVOS', 'ALERTAS'] as Filtro[]).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filtro === f}
              className={filtro === f ? 'mapa-tab is-active' : 'mapa-tab'}
              onClick={() => setFiltro(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <button type="button" className="btn primary btn-sm mapa-register">
          + Novo Registro
        </button>
      </section>

      <section className="mapa-layout">
        <div className="mapa-canvas">
          <MapContainer
            center={CENTRO_FAZENDA}
            zoom={15}
            scrollWheelZoom
            className="mapa-leaflet"
          >
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            <FlyToFocus target={focalizada ? focalizada.coords : null} />
            {visiveis.map((o) => (
              <Marker
                key={o.id}
                position={o.coords}
                icon={buildMarkerIcon(CATEGORIA_COR[o.categoria])}
                ref={(instance) => {
                  markerRefs.current[o.id] = instance;
                }}
                eventHandlers={{
                  click: () => setSelecionada(o.id),
                }}
              >
                <Popup>
                  <strong>{o.titulo}</strong>
                  <br />
                  {o.setor} · {CATEGORIA_LABEL[o.categoria]}
                  <br />
                  <span className="muted small">{o.horario}</span>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <div className="mapa-legend" aria-hidden>
            {(Object.keys(CATEGORIA_LABEL) as Categoria[]).map((c) => (
              <span key={c} className="mapa-legend__item">
                <span className="mapa-legend__dot" style={{ background: CATEGORIA_COR[c] }} />
                {CATEGORIA_LABEL[c]}
              </span>
            ))}
          </div>
        </div>

        <aside className="mapa-aside">
          <header className="mapa-aside__header">
            <h3>Ocorrências Visíveis</h3>
            <span className="mapa-aside__count">{visiveis.length}</span>
          </header>
          <ul className="mapa-aside__list">
            {visiveis.map((o) => (
              <li
                key={o.id}
                className={
                  selecionada === o.id
                    ? 'mapa-aside__item is-active'
                    : 'mapa-aside__item'
                }
              >
                <button type="button" onClick={() => setSelecionada(o.id)}>
                  <span
                    className="mapa-aside__dot"
                    style={{ background: CATEGORIA_COR[o.categoria] }}
                  />
                  <span className="mapa-aside__text">
                    <span className="mapa-aside__title">{o.titulo}</span>
                    <span className="muted small">{o.setor}</span>
                  </span>
                  <span className="muted small mapa-aside__time">{o.horario}</span>
                </button>
              </li>
            ))}
            {visiveis.length === 0 ? (
              <li className="mapa-aside__empty muted small">
                Nenhuma ocorrência para o filtro atual.
              </li>
            ) : null}
          </ul>
          <footer className="mapa-aside__footer">
            <button type="button" className="btn ghost btn-sm">
              Ver lista completa
            </button>
          </footer>
        </aside>
      </section>
    </main>
  );
}
