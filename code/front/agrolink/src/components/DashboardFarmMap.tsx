import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Polygon, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';
import {
  fetchMapaRegistroOcorrencia,
  type FazendaMapaRegistroDto,
  type SetorRegistroDto,
} from '../api/fazendaApi';
import {
  formatOcorrenciaHorario,
  labelCategoria,
  statusOcorrencia,
  type OcorrenciaDto,
} from '../api/ocorrenciasApi';
import { boundsFromRings, corSetorMapa, parsePolygonLatLng } from '../geo/fazendaMapGeometry';
import {
  buildOcorrenciaMarkerIcon,
  tipoMarcadorOcorrenciaFromDto,
} from '../geo/ocorrenciaMapMarker';

const CENTRO_FAZENDA: LatLngExpression = [-19.9191, -43.9387];

const OSM_TILE = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

const FAZENDA_PATH = {
  color: '#1f6b3a',
  weight: 2,
  dashArray: '12 10',
  lineCap: 'round' as const,
  fillColor: '#1f6b3a',
  fillOpacity: 0.08,
};

/** Acima disso (~28 km em latitude), pontos de ocorrência não devem “esticar” o enquadramento. */
const MAX_SPAN_GRAUS_OCORRENCIAS = 0.25;

/** Evita efeito disparar só por novo `LatLngBounds` com os mesmos cantos. */
function boundsSignature(b: L.LatLngBounds | null): string {
  if (!b?.isValid()) return '';
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  return [sw.lat, sw.lng, ne.lat, ne.lng].map((n) => n.toFixed(6)).join(',');
}

/**
 * Enquadra perímetro + setores + ocorrências depois que o mapa tem tamanho real
 * (evita zoom errado quando o painel lateral ainda está medindo layout).
 */
function FitPreviewBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  const sig = boundsSignature(bounds);

  const enquadrar = useCallback(() => {
    map.invalidateSize({ animate: false });
    if (bounds?.isValid()) {
      map.fitBounds(bounds, { padding: [22, 22], maxZoom: 19, animate: false });
    } else {
      map.setView(CENTRO_FAZENDA, 12, { animate: false });
    }
  }, [map, bounds]);

  useEffect(() => {
    let cancelled = false;
    let t2: number;

    const run = () => {
      if (cancelled) return;
      enquadrar();
      requestAnimationFrame(() => {
        if (cancelled) return;
        enquadrar();
        t2 = window.setTimeout(() => {
          if (!cancelled) enquadrar();
        }, 160);
      });
    };

    map.whenReady(() => {
      if (cancelled) return;
      requestAnimationFrame(run);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(t2);
    };
  }, [map, sig, enquadrar]);

  return null;
}

function RefitOnMapResize({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  const sig = boundsSignature(bounds);

  const enquadrar = useCallback(() => {
    map.invalidateSize({ animate: false });
    if (bounds?.isValid()) {
      map.fitBounds(bounds, { padding: [22, 22], maxZoom: 19, animate: false });
    }
  }, [map, bounds]);

  useEffect(() => {
    const el = map.getContainer();
    if (typeof ResizeObserver === 'undefined') return undefined;

    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => enquadrar());
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [map, sig, enquadrar]);

  return null;
}

type Props = {
  token: string | null;
  ocorrencias: OcorrenciaDto[];
  /** Quando o gerente ainda não cadastrou a fazenda (banner no dashboard). */
  gerenteSemFazenda?: boolean;
};

export function DashboardFarmMap({ token, ocorrencias, gerenteSemFazenda = false }: Props) {
  const [fazendas, setFazendas] = useState<FazendaMapaRegistroDto[]>([]);
  const [setores, setSetores] = useState<SetorRegistroDto[]>([]);
  const [mapaCarregado, setMapaCarregado] = useState(false);

  useEffect(() => {
    if (!token) {
      setFazendas([]);
      setSetores([]);
      setMapaCarregado(false);
      return;
    }
    let cancelled = false;
    setMapaCarregado(false);
    fetchMapaRegistroOcorrencia(token)
      .then((data) => {
        if (!cancelled) {
          setFazendas(data.fazendas);
          setSetores(data.setores);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFazendas([]);
          setSetores([]);
        }
      })
      .finally(() => {
        if (!cancelled) setMapaCarregado(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const setoresComPoligono = useMemo(
    () =>
      setores
        .map((s) => ({ setor: s, poly: parsePolygonLatLng(s.poligonoGeojson) }))
        .filter((x) => x.poly.length >= 3),
    [setores],
  );

  const ocorrenciasComCoord = useMemo(
    () =>
      ocorrencias.filter(
        (o) =>
          statusOcorrencia(o.status) === 'ABERTA' &&
          Number.isFinite(o.coordsY) &&
          Number.isFinite(o.coordsX),
      ),
    [ocorrencias],
  );

  /** Resposta “todas as fazendas” (ex.: funcionário) vs uma fazenda (gerente). */
  const apiListaGlobal = fazendas.length > 1;

  const setorIdsDasOcorrencias = useMemo(() => {
    const ids = new Set<number>();
    for (const o of ocorrenciasComCoord) {
      if (o.setorFazendaId != null && Number.isFinite(Number(o.setorFazendaId))) {
        ids.add(Number(o.setorFazendaId));
      }
    }
    return ids;
  }, [ocorrenciasComCoord]);

  /** Evita unir polígonos de fazendas inteiras do BD quando a API lista tudo. */
  const setoresEscopo = useMemo(() => {
    if (!apiListaGlobal) return setoresComPoligono;
    if (setorIdsDasOcorrencias.size === 0) return [];
    return setoresComPoligono.filter(({ setor }) => setorIdsDasOcorrencias.has(setor.id));
  }, [apiListaGlobal, setoresComPoligono, setorIdsDasOcorrencias]);

  const fazendasEscopo = useMemo(() => {
    if (!apiListaGlobal) return fazendas;
    if (setorIdsDasOcorrencias.size === 0) return [];
    const nomes = new Set(setoresEscopo.map(({ setor }) => setor.fazendaNome));
    return fazendas.filter((f) => nomes.has(f.nome));
  }, [apiListaGlobal, fazendas, setoresEscopo, setorIdsDasOcorrencias]);

  const ocorrenciasEscopo = useMemo(() => {
    if (!apiListaGlobal) return ocorrenciasComCoord;
    if (setorIdsDasOcorrencias.size === 0) return ocorrenciasComCoord;
    return ocorrenciasComCoord.filter(
      (o) => o.setorFazendaId != null && setorIdsDasOcorrencias.has(Number(o.setorFazendaId)),
    );
  }, [apiListaGlobal, setorIdsDasOcorrencias, ocorrenciasComCoord]);

  /** Só geometria cadastrada (perímetro + setores) — base para centralizar na fazenda. */
  const boundsFazendaSetores = useMemo(() => {
    const rings: [number, number][][] = [];
    for (const f of fazendasEscopo) {
      const p = parsePolygonLatLng(f.perimetroGeojson);
      if (p.length >= 3) rings.push(p);
    }
    for (const { poly } of setoresEscopo) {
      rings.push(poly);
    }
    return boundsFromRings(rings);
  }, [fazendasEscopo, setoresEscopo]);

  const boundsSohOcorrencias = useMemo(() => {
    const rings: [number, number][][] = ocorrenciasEscopo.map((o) => [[o.coordsY!, o.coordsX!]]);
    return boundsFromRings(rings);
  }, [ocorrenciasEscopo]);

  /** Quando só há pontos e estão muito longe uns dos outros, não “esticar” o mapa. */
  const boundsOcorrenciasEnquadraveis = useMemo((): L.LatLngBounds | null => {
    if (!boundsSohOcorrencias?.isValid()) return null;
    const sw = boundsSohOcorrencias.getSouthWest();
    const ne = boundsSohOcorrencias.getNorthEast();
    const latSpan = ne.lat - sw.lat;
    const lngSpan = ne.lng - sw.lng;
    if (latSpan <= MAX_SPAN_GRAUS_OCORRENCIAS && lngSpan <= MAX_SPAN_GRAUS_OCORRENCIAS) {
      return boundsSohOcorrencias;
    }
    const ref = ocorrenciasEscopo[0];
    if (!ref) return null;
    const lat = ref.coordsY!;
    const lng = ref.coordsX!;
    const d = 0.014;
    return L.latLngBounds(L.latLng(lat - d, lng - d), L.latLng(lat + d, lng + d));
  }, [boundsSohOcorrencias, ocorrenciasEscopo]);

  /**
   * Enquadramento: 1) perímetro + setores da fazenda em escopo; 2) senão pontos das ocorrências
   * (no mesmo escopo); 3) senão fallback demo.
   */
  const previewBounds = useMemo((): L.LatLngBounds | null => {
    if (boundsFazendaSetores?.isValid()) return boundsFazendaSetores;
    if (boundsOcorrenciasEnquadraveis?.isValid()) return boundsOcorrenciasEnquadraveis;
    return null;
  }, [boundsFazendaSetores, boundsOcorrenciasEnquadraveis]);

  const mapCenter: LatLngExpression = previewBounds?.isValid() ? previewBounds.getCenter() : CENTRO_FAZENDA;
  const zoomInicial = previewBounds?.isValid() ? 15 : 12;

  if (!token) {
    return (
      <div className="dash-widget__map-live dash-widget__map-live--placeholder muted small" role="status">
        Entre na conta para ver o perímetro da fazenda e as ocorrências no mapa.
      </div>
    );
  }

  if (!mapaCarregado) {
    return (
      <div className="dash-widget__map-live dash-widget__map-live--placeholder muted small" role="status">
        Carregando mapa…
      </div>
    );
  }

  const semDadosMapa = fazendas.length === 0 && setores.length === 0 && ocorrenciasComCoord.length === 0;
  if (semDadosMapa) {
    return (
      <div className="dash-widget__map-live dash-widget__map-live--placeholder muted small" role="status">
        {gerenteSemFazenda
          ? 'Cadastre sua fazenda em Minha fazenda para ver o perímetro e o mapa aqui.'
          : 'Você ainda não está vinculado a uma fazenda. Aceite um convite de equipe nas notificações para ver o mapa da propriedade.'}
      </div>
    );
  }

  return (
    <div className="dash-widget__map-live" role="region" aria-label="Mapa da fazenda">
      <MapContainer
        center={mapCenter}
        zoom={zoomInicial}
        className="dash-widget__map-leaflet"
        scrollWheelZoom={false}
        dragging
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl
      >
        <TileLayer attribution={OSM_TILE.attribution} url={OSM_TILE.url} maxZoom={19} />
        <FitPreviewBounds bounds={previewBounds} />
        <RefitOnMapResize bounds={previewBounds} />
        {fazendasEscopo.map((f) => {
          const poly = parsePolygonLatLng(f.perimetroGeojson);
          if (poly.length < 3) return null;
          return (
            <Polygon key={`faz-${f.id}`} positions={poly} pathOptions={FAZENDA_PATH}>
              <Tooltip sticky direction="top">
                {f.nome}
              </Tooltip>
            </Polygon>
          );
        })}
        {setoresEscopo.map(({ setor: sec, poly }) => {
          const cor = corSetorMapa(sec.id);
          return (
            <Polygon
              key={`setor-${sec.id}`}
              positions={poly}
              pathOptions={{
                color: cor,
                weight: 2,
                fillColor: cor,
                fillOpacity: 0.1,
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
        {ocorrenciasComCoord.map((o) => (
          <Marker
            key={o.id}
            position={[o.coordsY!, o.coordsX!]}
            icon={buildOcorrenciaMarkerIcon(tipoMarcadorOcorrenciaFromDto(o))}
          >
            <Popup>
              <strong>{o.titulo}</strong>
              <br />
              <span className="muted small">
                {labelCategoria(o.categoria)} · {formatOcorrenciaHorario(o.horario)}
              </span>
              <br />
              <Link to={`/ocorrencias/${o.id}`} className="app-map-popup__cta">
                Ver ocorrência
              </Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
