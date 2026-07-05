import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';
import { AppShell } from '../components/AppShell';
import { SemFazendaAviso } from '../components/SemFazendaAviso';
import {
  IconMapLayers,
  IconMapLocate,
  IconMapZoomIn,
  IconMapZoomOut,
} from '../components/icons/SystemIcons';
import {
  formatOcorrenciaHorario,
  labelCategoria,
  prioridadeOcorrencia,
  prioridadeOcorrenciaLabel,
  prioridadeOcorrenciaTone,
  statusOcorrencia,
} from '../api/ocorrenciasApi';
import { listOcorrencias } from '../offline/ocorrenciasStore';
import { SyncPendingBadge, isOcorrenciaPendingSync } from '../components/SyncPendingBadge';
import {
  fetchMapaRegistroOcorrencia,
  type FazendaMapaRegistroDto,
  type SetorRegistroDto,
} from '../api/fazendaApi';
import { useAuth } from '../auth/AuthContext';
import { useConnectivity } from '../hooks/useConnectivity';
import { boundsFromRings, corSetorMapa, parsePolygonLatLng } from '../geo/fazendaMapGeometry';
import {
  buildOcorrenciaMarkerIcon,
  tipoMarcadorOcorrencia,
} from '../geo/ocorrenciaMapMarker';

type FiltroRapido = 'abertas' | 'criticos' | 'alertas' | 'todas';

type OcorrenciaMapa = {
  id: string;
  data: string;
  titulo: string;
  tags: string[];
  critico: boolean;
  status: 'ABERTA' | 'RESOLVIDA';
  prioridadeLabel: string;
  prioridadeTone: 'urgente' | 'alta' | 'media' | 'baixa';
  pendingSync?: boolean;
  tipoMarcador: ReturnType<typeof tipoMarcadorOcorrencia>;
  coords: [number, number];
};

/** Região metropolitana de Belo Horizonte (demo + fallback quando a geo do navegador é só IP/rede). */
const CENTRO_FAZENDA: LatLngExpression = [-19.9191, -43.9387];

function matchesFiltroRapido(o: OcorrenciaMapa, filtro: FiltroRapido) {
  if (filtro === 'abertas') return o.status === 'ABERTA';
  if (filtro === 'criticos') return o.critico;
  if (filtro === 'alertas') {
    return o.tags.some((t) => /alerta|emergência/i.test(t));
  }
  return true; // todas
}

function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);
  return null;
}

function FlyToTarget({ target, zoom }: { target: LatLngExpression | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, zoom, { duration: 0.85 });
    }
  }, [map, target, zoom]);
  return null;
}

/** Enquadra fazenda e setores ao abrir o mapa (uma vez), salvo quando há foco numa ocorrência. */
function FitMapToBoundsOnce({ bounds, when }: { bounds: L.LatLngBounds | null; when: boolean }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !when || !bounds?.isValid()) return;
    done.current = true;
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18, animate: false });
  }, [map, bounds, when]);
  return null;
}

/** Garante que o marcador "você está aqui" fique acima de polígonos e ocorrências. */
function EnsureUserLocationPane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('userLocationPane')) {
      const pane = map.createPane('userLocationPane');
      pane.style.zIndex = '650';
    }
  }, [map]);
  return null;
}

type BaseLayer = 'ruas' | 'satelite';

const OSM_TILE = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

/** Imagem de satélite (aérea) — Esri World Imagery (uso comum com Leaflet; não substitui dados OSM nas ruas). */
const ESRI_WORLD_IMAGERY = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution:
    'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
};

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 25000,
};

const GEO_OPTIONS_FALLBACK: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 120_000,
  timeout: 15000,
};

/** Raio máximo desenhado no mapa (evita círculo gigante quando a precisão vem só de IP/rede). */
const MAX_RAIO_VISUAL_METROS = 800;

function zoomParaPrecisaoMetros(accuracyM: number): number {
  if (accuracyM < 80) return 17;
  if (accuracyM < 400) return 16;
  if (accuracyM < 2000) return 15;
  if (accuracyM < 8000) return 14;
  return 13;
}

function raioVisualMetros(accuracyM: number): number {
  return Math.min(Math.max(accuracyM, 12), MAX_RAIO_VISUAL_METROS);
}

function obterPosicaoAtual(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
  }).catch(
    () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS_FALLBACK);
      }),
  );
}

type MinhaPosicao = { lat: number; lng: number; accuracy: number };

export function MapPage() {
  const location = useLocation();
  const focusId = (location.state as { focusId?: string } | null)?.focusId ?? null;
  const { token, user } = useAuth();
  const { syncVersion } = useConnectivity();
  const semFazenda = user != null && !user.temFazenda;

  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const [busca, setBusca] = useState('');
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>('abertas');
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('satelite');
  const [selecionada, setSelecionada] = useState<string | null>(focusId);
  const [flyTarget, setFlyTarget] = useState<LatLngExpression | null>(null);
  const [minhaPosicao, setMinhaPosicao] = useState<MinhaPosicao | null>(null);
  const [locateStatus, setLocateStatus] = useState<string | null>(null);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaMapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fazendasMapa, setFazendasMapa] = useState<FazendaMapaRegistroDto[]>([]);
  const [setoresMapa, setSetoresMapa] = useState<SetorRegistroDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    if (!token || semFazenda) {
      setOcorrencias([]);
      setLoading(false);
      return;
    }

    listOcorrencias(token)
      .then(({ items: data }) => {
        if (cancelled) return;
        const mapped = data
          .filter((o) => Number.isFinite(o.coordsY) && Number.isFinite(o.coordsX))
          .map((o) => {
            const prioridade = prioridadeOcorrencia(o.prioridade);
            const prioridadeTone = prioridadeOcorrenciaTone(prioridade);
            return {
              id: String(o.id),
              data: formatOcorrenciaHorario(o.horario),
              titulo: o.titulo,
              tags: [labelCategoria(o.categoria), o.setor].filter(Boolean),
              critico: prioridadeTone === 'urgente',
              status: statusOcorrencia(o.status),
              prioridadeLabel: prioridadeOcorrenciaLabel(prioridade),
              prioridadeTone,
              pendingSync: isOcorrenciaPendingSync(o),
              tipoMarcador: tipoMarcadorOcorrencia({ status: o.status, prioridade: o.prioridade }),
              coords: [o.coordsY, o.coordsX] as [number, number],
            };
          });
        setOcorrencias(mapped);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Nao foi possivel carregar as ocorrencias.');
        setOcorrencias([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, syncVersion, semFazenda]);

  useEffect(() => {
    if (!token || semFazenda) {
      setFazendasMapa([]);
      setSetoresMapa([]);
      return;
    }
    let cancelled = false;
    fetchMapaRegistroOcorrencia(token)
      .then((data) => {
        if (cancelled) return;
        setFazendasMapa(data.fazendas);
        setSetoresMapa(data.setores);
      })
      .catch(() => {
        if (!cancelled) {
          setFazendasMapa([]);
          setSetoresMapa([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, semFazenda]);

  const setoresComPoligono = useMemo(
    () =>
      setoresMapa
        .map((s) => ({ setor: s, poly: parsePolygonLatLng(s.poligonoGeojson) }))
        .filter((x) => x.poly.length >= 3),
    [setoresMapa],
  );

  const mapDataBounds = useMemo(() => {
    const rings: [number, number][][] = [];
    for (const f of fazendasMapa) {
      const p = parsePolygonLatLng(f.perimetroGeojson);
      if (p.length >= 3) rings.push(p);
    }
    for (const { poly } of setoresComPoligono) {
      rings.push(poly);
    }
    return boundsFromRings(rings);
  }, [fazendasMapa, setoresComPoligono]);

  const mapCenter = useMemo((): LatLngExpression => {
    if (mapDataBounds?.isValid()) return mapDataBounds.getCenter();
    return CENTRO_FAZENDA;
  }, [mapDataBounds]);

  const shouldFitFarmBounds = useMemo(() => {
    if (!mapDataBounds?.isValid()) return false;
    if (!focusId) return true;
    if (loading) return false;
    const found = ocorrencias.some((x) => x.id === focusId);
    return !found;
  }, [mapDataBounds, focusId, loading, ocorrencias]);

  /** No satélite o verde some na copa; no mapa de ruas mantém o traço discreto em verde. */
  const fazendaPerimetroPathOptions = useMemo(
    () =>
      baseLayer === 'satelite'
        ? {
            color: '#ffcc00',
            weight: 3.5,
            opacity: 1,
            dashArray: '16 12',
            lineCap: 'round' as const,
            fillColor: '#fffde7',
            fillOpacity: 0.14,
          }
        : {
            color: '#1f6b3a',
            weight: 2,
            dashArray: '12 10',
            lineCap: 'round' as const,
            fillColor: '#1f6b3a',
            fillOpacity: 0.06,
          },
    [baseLayer],
  );

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ocorrencias.filter((o) => {
      if (!matchesFiltroRapido(o, filtroRapido)) return false;
      if (!termo) return true;
      return (
        o.id.toLowerCase().includes(termo) ||
        o.titulo.toLowerCase().includes(termo) ||
        o.tags.some((t) => t.toLowerCase().includes(termo))
      );
    });
  }, [busca, filtroRapido, ocorrencias]);

  const focarOcorrencia = useCallback((o: OcorrenciaMapa) => {
    setSelecionada(o.id);
    setFlyTarget(o.coords);
  }, []);

  useEffect(() => {
    if (!focusId) return;
    const o = ocorrencias.find((x) => x.id === focusId);
    if (o) focarOcorrencia(o);
  }, [focusId, focarOcorrencia, ocorrencias]);

  useEffect(() => {
    if (!selecionada) return;
    const m = markerRefs.current[selecionada];
    m?.openPopup();
  }, [selecionada]);

  const aplicarPosicao = useCallback((pos: GeolocationPosition, fly: boolean) => {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setMinhaPosicao({ lat, lng, accuracy });
    setLocateStatus(null);
    const map = mapRef.current;
    if (fly && map) {
      map.flyTo([lat, lng], zoomParaPrecisaoMetros(accuracy), { duration: 0.75 });
    }
  }, []);

  const onLocate = useCallback(
    (fly = true) => {
      const map = mapRef.current;
      if (!navigator.geolocation) {
        setMinhaPosicao(null);
        setLocateStatus('Geolocalização não disponível neste navegador.');
        if (fly && map) map.flyTo(mapCenter, 15, { duration: 0.65 });
        return;
      }
      setLocateStatus('Obtendo localização…');
      void obterPosicaoAtual()
        .then((pos) => aplicarPosicao(pos, fly))
        .catch(() => {
          setMinhaPosicao(null);
          setLocateStatus('Permita o acesso à localização ou use HTTPS/localhost.');
          if (fly && map) map.flyTo(mapCenter, 15, { duration: 0.65 });
        });
    },
    [aplicarPosicao, mapCenter],
  );

  /** Ao abrir o mapa: pede localização e desenha o marcador (sem mover o zoom inicial da fazenda). */
  const onLocateRef = useRef(onLocate);
  onLocateRef.current = onLocate;
  useEffect(() => {
    const t = window.setTimeout(() => onLocateRef.current(false), 600);
    return () => window.clearTimeout(t);
  }, []);

  /** Atualiza o marcador enquanto a página estiver aberta. */
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => aplicarPosicao(pos, false),
      () => {},
      GEO_OPTIONS_FALLBACK,
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [aplicarPosicao]);

  const cycleCamadas = useCallback(() => {
    setBaseLayer((b) => (b === 'ruas' ? 'satelite' : 'ruas'));
  }, []);

  if (semFazenda) {
    return (
      <AppShell>
        <div className="app-map-body">
          <div className="ocorrencias-page" style={{ padding: '1.5rem' }}>
            <h1 className="ocorrencias-page__title">Mapa da fazenda</h1>
            <SemFazendaAviso papel={user?.papel} />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="app-map-body">
        <div className="app-map-canvas">
          <div className="app-map-filters">
            <input
              type="search"
              placeholder="Filtrar por tipo, área ou código…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Filtrar ocorrências no mapa"
            />
            <div className="app-map-filters__toggles" role="group" aria-label="Filtro rápido">
              <button
                type="button"
                className={filtroRapido === 'abertas' ? 'is-active' : ''}
                onClick={() => setFiltroRapido('abertas')}
              >
                Abertas
              </button>
              <button
                type="button"
                className={`app-map-filters__crit${filtroRapido === 'criticos' ? ' is-active' : ''}`}
                onClick={() => setFiltroRapido('criticos')}
              >
                Críticos
              </button>
              <button
                type="button"
                className={filtroRapido === 'alertas' ? 'is-active' : ''}
                onClick={() => setFiltroRapido('alertas')}
              >
                Alertas
              </button>
              <button
                type="button"
                className={filtroRapido === 'todas' ? 'is-active' : ''}
                onClick={() => setFiltroRapido('todas')}
              >
                Todas
              </button>
            </div>
          </div>

          <MapContainer
            center={mapCenter}
            zoom={mapDataBounds?.isValid() ? 15 : 14}
            scrollWheelZoom
            className="app-map-leaflet-wrap"
          >
            <MapRefCapture mapRef={mapRef} />
            <EnsureUserLocationPane />
            {baseLayer === 'ruas' ? (
              <TileLayer attribution={OSM_TILE.attribution} url={OSM_TILE.url} maxZoom={19} />
            ) : (
              <TileLayer
                attribution={ESRI_WORLD_IMAGERY.attribution}
                url={ESRI_WORLD_IMAGERY.url}
                maxZoom={19}
              />
            )}
            <FitMapToBoundsOnce bounds={mapDataBounds} when={shouldFitFarmBounds} />
            <FlyToTarget target={flyTarget} zoom={16} />
            {fazendasMapa.map((f) => {
              const poly = parsePolygonLatLng(f.perimetroGeojson);
              if (poly.length < 3) return null;
              return (
                <Polygon
                  key={`fazenda-${f.id}`}
                  positions={poly}
                  pathOptions={fazendaPerimetroPathOptions}
                >
                  <Tooltip sticky>{f.nome}</Tooltip>
                </Polygon>
              );
            })}
            {setoresComPoligono.map(({ setor: sec, poly }) => {
              const cor = corSetorMapa(sec.id);
              return (
                <Polygon
                  key={`setor-${sec.id}`}
                  positions={poly}
                  pathOptions={{
                    color: cor,
                    weight: 2,
                    fillColor: cor,
                    fillOpacity: 0.12,
                  }}
                >
                  <Tooltip sticky>
                    {sec.nome}
                    <br />
                    <span className="muted small">{sec.fazendaNome}</span>
                  </Tooltip>
                </Polygon>
              );
            })}
            {visiveis.map((o) => (
              <Marker
                key={o.id}
                position={o.coords}
                icon={buildOcorrenciaMarkerIcon(o.tipoMarcador)}
                ref={(instance) => {
                  markerRefs.current[o.id] = instance;
                }}
                eventHandlers={{
                  click: () => focarOcorrencia(o),
                }}
              >
                <Popup>
                  <strong>{o.titulo}</strong>
                  <br />
                  <span className="muted small">
                    {o.id} · {o.data}
                  </span>
                  <br />
                  {o.tags.join(' · ')}
                  <br />
                  <Link to={`/ocorrencias/${o.id}`} className="app-map-popup__cta">
                    Ver ocorrência
                  </Link>
                </Popup>
              </Marker>
            ))}
            {minhaPosicao ? (
              <>
                <Circle
                  center={[minhaPosicao.lat, minhaPosicao.lng]}
                  radius={raioVisualMetros(minhaPosicao.accuracy)}
                  pane="userLocationPane"
                  interactive={false}
                  pathOptions={{
                    className: 'map-user-accuracy',
                    color: '#1565c0',
                    fillColor: '#2196f3',
                    fillOpacity: 0.18,
                    weight: 2,
                  }}
                />
                <CircleMarker
                  center={[minhaPosicao.lat, minhaPosicao.lng]}
                  radius={9}
                  pane="userLocationPane"
                  pathOptions={{
                    color: '#ffffff',
                    fillColor: '#1976d2',
                    fillOpacity: 1,
                    weight: 3,
                  }}
                  className="map-user-dot"
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent className="map-user-tooltip-wrap">
                    Você está aqui
                  </Tooltip>
                </CircleMarker>
              </>
            ) : null}
          </MapContainer>

          {locateStatus ? (
            <p className="app-map-locate-hint muted small" role="status">
              {locateStatus}
            </p>
          ) : null}

          <div className="app-map-controls app-map-controls--bl">
            <span className="app-map-controls__seg" role="group" aria-label="Tipo de mapa">
              <button
                type="button"
                className={baseLayer === 'satelite' ? 'is-on' : ''}
                onClick={() => setBaseLayer('satelite')}
                title="Imagem de satélite (Esri World Imagery)"
              >
                Satélite
              </button>
              <button
                type="button"
                className={baseLayer === 'ruas' ? 'is-on' : ''}
                onClick={() => setBaseLayer('ruas')}
                title="Mapa de ruas (OpenStreetMap)"
              >
                Mapa
              </button>
            </span>
          </div>
          <div className="app-map-controls app-map-controls--br" aria-label="Controles do mapa">
            <button type="button" title="Aproximar" onClick={() => mapRef.current?.zoomIn()}>
              <IconMapZoomIn />
            </button>
            <button type="button" title="Afastar" onClick={() => mapRef.current?.zoomOut()}>
              <IconMapZoomOut />
            </button>
            <button type="button" title="Onde estou" onClick={() => onLocate(true)}>
              <IconMapLocate />
            </button>
            <button type="button" title="Alternar entre satélite e mapa de ruas" onClick={cycleCamadas}>
              <IconMapLayers />
            </button>
          </div>
        </div>

        {loadError ? (
          <p className="error-text" role="alert">
            {loadError}
          </p>
        ) : null}

        <aside className="app-map-panel" aria-label="Ocorrências visíveis no mapa">
          <div className="app-map-panel__head">
            <h2>Ocorrências visíveis</h2>
            <span className="app-map-panel__count">{visiveis.length}</span>
          </div>
          <ul className="app-map-panel__list">
            {loading ? (
              <li className="muted small">Carregando ocorrencias...</li>
            ) : null}
            {visiveis.map((o) => (
              <li key={o.id}>
                <article
                  className={`app-map-panel__card${o.critico ? ' app-map-panel__card--crit' : ''}${selecionada === o.id ? ' app-map-panel__card--active' : ''}${o.pendingSync ? ' app-map-panel__card--sync-pending' : ''}`}
                >
                  <button type="button" className="app-map-panel__card-main" onClick={() => focarOcorrencia(o)}>
                    <div className="app-map-panel__card-top">
                      <div className="app-map-panel__card-meta muted small">
                        {o.pendingSync ? 'local · ' : ''}{o.id} · {o.data}
                      </div>
                      <div className="app-map-panel__card-badges">
                        {o.pendingSync ? <SyncPendingBadge /> : null}
                        <span className={`occ-card__prio occ-card__prio--${o.prioridadeTone}`}>
                          {o.prioridadeLabel.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <p className="app-map-panel__card-title">{o.titulo}</p>
                    <div className="app-map-panel__tags">
                      {o.tags.map((t) => (
                        <span key={t} className="app-map-panel__tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  </button>
                  <div className="app-map-panel__card-actions">
                    <Link
                      to={`/ocorrencias/${o.id}`}
                      className="occ-card__arrow occ-card__arrow--link app-map-panel__card-link"
                      aria-label={`Ver detalhes: ${o.titulo}`}
                      onClick={(e) => {
                        if (o.pendingSync) e.preventDefault();
                      }}
                      title={o.pendingSync ? 'Disponível após sincronizar' : undefined}
                      style={o.pendingSync ? { opacity: 0.45, pointerEvents: 'none' } : undefined}
                    >
                      →
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
          <Link to="/ocorrencias" className="app-map-panel__cta">
            Ver lista completa →
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
