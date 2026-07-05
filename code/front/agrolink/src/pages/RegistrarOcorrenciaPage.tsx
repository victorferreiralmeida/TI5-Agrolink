import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../auth/AuthContext';
import {
  type FazendaMapaRegistroDto,
  type SetorRegistroDto,
} from '../api/fazendaApi';
import {
  boundsFromRings,
  corSetorMapa,
  parsePolygonLatLng,
  type LatLng,
} from '../geo/fazendaMapGeometry';
import {
  CATEGORIAS_REGISTRO,
  PRIORIDADES_REGISTRO,
  type PrioridadeOcorrencia,
} from '../api/ocorrenciasApi';
import { createOcorrenciaOffline, loadFazendaMapa } from '../offline/ocorrenciasStore';

/** Centro demo (Belo Horizonte região) — mesmo referencial usado no mapa. */
const DEFAULT_LAT = -19.9191;
const DEFAULT_LNG = -43.9387;
const MAX_UPLOAD_IMAGENS = 6;

/** Ponto dentro do polígono (anel em [lat, lng]). */
function pointInPolygon(lat: number, lng: number, poly: LatLng[]): boolean {
  const x = lng;
  const y = lat;
  const n = poly.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi] = poly[i]!;
    const [yj, xj] = poly[j]!;
    const denom = yj - yi;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (Math.abs(denom) < 1e-18 ? 1e-18 : denom) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function areaPoligonoAprox(poly: LatLng[]): number {
  if (poly.length < 3) return Number.POSITIVE_INFINITY;
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [lat1, lng1] = poly[i]!;
    const [lat2, lng2] = poly[(i + 1) % poly.length]!;
    s += lng1 * lat2 - lng2 * lat1;
  }
  return Math.abs(s / 2);
}

/** Centraliza o mapa na fazenda/setores ao abrir a tela (uma vez). */
function FitMapToFarmsOnce({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !bounds?.isValid()) return;
    done.current = true;
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 18, animate: false });
  }, [map, bounds]);
  return null;
}

/** Chamado após “Usar minha localização” para focar no usuário (sem substituir o foco inicial da fazenda). */
function FlyMapToUserPosition({ lat, lng, flyNonce }: { lat: number; lng: number; flyNonce: number }) {
  const map = useMap();
  const lastNonce = useRef(0);
  useEffect(() => {
    if (flyNonce === 0 || flyNonce === lastNonce.current) return;
    lastNonce.current = flyNonce;
    map.flyTo([lat, lng], Math.max(17, map.getZoom()), { duration: 0.45 });
  }, [map, lat, lng, flyNonce]);
  return null;
}

type ImagemSelecionada = {
  id: string;
  file: File;
  previewUrl: string;
};

function MapClickPicker({
  onPick,
}: {
  onPick: (coords: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click: (event) => {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function nowLocalInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/**
 * Registro de ocorrência via API (`POST /api/ocorrencias`).
 */
export function RegistrarOcorrenciaPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [titulo, setTitulo] = useState('');
  const [setor, setSetor] = useState('');
  const [setoresCadastrados, setSetoresCadastrados] = useState<SetorRegistroDto[]>([]);
  const [fazendasMapa, setFazendasMapa] = useState<FazendaMapaRegistroDto[]>([]);
  /** Incrementa após geolocalização bem-sucedida para focar o mapa no usuário. */
  const [mapFlyToUserNonce, setMapFlyToUserNonce] = useState(0);
  /** `"livre"` ou id numérico em string */
  const [setorChoice, setSetorChoice] = useState<string>('livre');
  const [categoria, setCategoria] = useState(CATEGORIAS_REGISTRO[0]?.value ?? 'PRAGA');
  const [prioridade, setPrioridade] = useState<PrioridadeOcorrencia>('MEDIA');
  const [descricao, setDescricao] = useState('');
  const [ocorridoEm, setOcorridoEm] = useState(nowLocalInputValue());
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  /** Clique no mapa: posição da ocorrência ou escolha de setor por polígono. */
  const [modoMapa, setModoMapa] = useState<'local' | 'setor'>('local');
  const [imagens, setImagens] = useState<ImagemSelecionada[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapaLoadError, setMapaLoadError] = useState<string | null>(null);

  const setoresComPoligono = useMemo(
    () =>
      setoresCadastrados
        .map((s) => ({ setor: s, poly: parsePolygonLatLng(s.poligonoGeojson) }))
        .filter((x) => x.poly.length >= 3),
    [setoresCadastrados],
  );

  const mapDataBounds = useMemo(() => {
    const rings: LatLng[][] = [];
    for (const f of fazendasMapa) {
      const p = parsePolygonLatLng(f.perimetroGeojson);
      if (p.length >= 3) rings.push(p);
    }
    for (const { poly } of setoresComPoligono) {
      rings.push(poly);
    }
    return boundsFromRings(rings);
  }, [fazendasMapa, setoresComPoligono]);

  useEffect(() => {
    if (!mapDataBounds?.isValid()) return;
    const c = mapDataBounds.getCenter();
    setLat(c.lat);
    setLng(c.lng);
  }, [mapDataBounds]);

  useEffect(() => {
    return () => {
      imagens.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, [imagens]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setMapaLoadError(null);
    loadFazendaMapa(token)
      .then((data) => {
        if (cancelled) return;
        setFazendasMapa(data.fazendas);
        setSetoresCadastrados(data.setores);
        if (data.setores.length > 0) {
          setSetorChoice(String(data.setores[0]!.id));
        } else if (data.fazendas.length === 0) {
          setMapaLoadError(
            'Nenhuma fazenda vinculada à sua conta. Cadastre a fazenda (gerente) ou aceite um convite da equipe.',
          );
        } else {
          setMapaLoadError(
            'Sua fazenda ainda não tem setores cadastrados. Peça ao gerente para criar setores em Minha fazenda.',
          );
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFazendasMapa([]);
          setSetoresCadastrados([]);
          setMapaLoadError(
            err instanceof Error ? err.message : 'Não foi possível carregar os setores da fazenda.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function encontrarSetorNoPonto(lat: number, lng: number): SetorRegistroDto | null {
    const matches = setoresComPoligono.filter(({ poly }) => pointInPolygon(lat, lng, poly));
    if (matches.length === 0) return null;
    matches.sort((a, b) => areaPoligonoAprox(a.poly) - areaPoligonoAprox(b.poly));
    return matches[0]!.setor;
  }

  const setorSelecionado = useMemo(
    () => setoresCadastrados.find((s) => String(s.id) === setorChoice) ?? null,
    [setoresCadastrados, setorChoice],
  );

  function capturarLocalizacao() {
    setGeoStatus(null);
    if (!navigator.geolocation) {
      setGeoStatus('Geolocalização não disponível neste navegador.');
      return;
    }
    setGeoStatus('Obtendo localização…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setMapFlyToUserNonce((n) => n + 1);
        setGeoStatus(
          pos.coords.accuracy
            ? `Precisão de ~${Math.round(pos.coords.accuracy)} m.`
            : 'Localização atualizada.',
        );
      },
      () => {
        setGeoStatus('Não foi possível obter a localização. Ajuste latitude e longitude manualmente.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  function handleSelecionarImagens(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;

    setImagens((prev) => {
      const vagas = Math.max(0, MAX_UPLOAD_IMAGENS - prev.length);
      const toAdd = files.slice(0, vagas).map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...toAdd];
    });
    e.currentTarget.value = '';
  }

  function removerImagem(id: string) {
    setImagens((prev) => {
      const alvo = prev.find((img) => img.id === id);
      if (alvo) URL.revokeObjectURL(alvo.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const t = titulo.trim();
    const useSetorCadastrado = setorChoice !== 'livre' && setoresCadastrados.some((s) => String(s.id) === setorChoice);
    if (!t) {
      setError('Preencha o título.');
      return;
    }
    if (!token) {
      setError('Faça login para registrar uma ocorrência.');
      return;
    }
    if (!useSetorCadastrado) {
      setError('Selecione um setor cadastrado na lista — a ocorrência precisa estar vinculada à sua fazenda.');
      return;
    }
    setLoading(true);
    try {
      const setorId = useSetorCadastrado ? Number(setorChoice) : undefined;
      const setorNome = setoresCadastrados.find((s) => String(s.id) === setorChoice)?.nome;
      const { ocorrencia: criada, queued } = await createOcorrenciaOffline(
        {
          titulo: t,
          setor: '',
          setorId: setorId ?? undefined,
          categoria: categoria.trim(),
          prioridade,
          descricao: descricao.trim(),
          horario: ocorridoEm ? new Date(ocorridoEm).toISOString() : undefined,
          coordsX: lng,
          coordsY: lat,
        },
        imagens.map((img) => img.file),
        token,
        setorNome,
      );
      if (queued) {
        navigate('/ocorrencias', { replace: false, state: { offlineQueued: true } });
        return;
      }
      navigate(`/ocorrencias/${criada.id}`, { replace: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <form className="registrar-page" onSubmit={handleSubmit} noValidate>
        <div className="registrar-page__head">
          <Link to="/ocorrencias" className="registrar-page__back">
            ← Voltar
          </Link>
          <div className="registrar-page__head-row">
            <div>
              <h1 className="registrar-page__title">Registrar nova ocorrência</h1>
              <p className="registrar-page__subtitle muted">
                Os dados são enviados ao servidor e aparecem na lista e no detalhe da ocorrência.
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <p className="error-text registrar-page__alert" role="alert">
            {error}
          </p>
        ) : null}

        {mapaLoadError ? (
          <p className="error-text registrar-page__alert" role="alert">
            {mapaLoadError}
          </p>
        ) : null}

        <div className="registrar-page__sections">
          <section className="registrar-card">
            <h2 className="registrar-card__title">Localização do evento</h2>
            <div className="registrar-loc">
              <p className="registrar-loc__label">Coordenadas (WGS84)</p>
              <p className="muted small registrar-loc__hint">
                {modoMapa === 'local'
                  ? 'Contorno verde tracejado = perímetro da fazenda. Clique no mapa para marcar o ponto da ocorrência.'
                  : 'Clique dentro de um polígono de setor para selecioná-lo (o ponto da ocorrência não muda).'}
              </p>
              <div className="registrar-loc__map-mode" role="group" aria-label="Modo do clique no mapa">
                <button
                  type="button"
                  className={`btn ghost btn-sm${modoMapa === 'local' ? ' registrar-loc__map-mode-btn--active' : ''}`}
                  onClick={() => {
                    setModoMapa('local');
                    setGeoStatus(null);
                  }}
                >
                  Marcar local
                </button>
                <button
                  type="button"
                  className={`btn ghost btn-sm${modoMapa === 'setor' ? ' registrar-loc__map-mode-btn--active' : ''}`}
                  disabled={setoresComPoligono.length === 0}
                  onClick={() => {
                    setModoMapa('setor');
                    setGeoStatus(
                      setoresComPoligono.length === 0
                        ? 'Nenhum setor com polígono cadastrado.'
                        : 'Clique dentro do setor desejado.',
                    );
                  }}
                >
                  Escolher setor no mapa
                </button>
              </div>
              {setoresComPoligono.length === 0 && setoresCadastrados.length > 0 ? (
                <p className="muted small">Setores sem polígono: use a lista ao lado ou cadastre polígonos em Minha fazenda.</p>
              ) : null}
              {fazendasMapa.length > 0 && !fazendasMapa.some((f) => parsePolygonLatLng(f.perimetroGeojson).length >= 3) ? (
                <p className="muted small">
                  Nenhum perímetro de fazenda cadastrado: o mapa foca nos setores (ou no padrão). Cadastre o perímetro em Minha fazenda.
                </p>
              ) : null}
              <div className="registrar-loc__map-wrap">
                <MapContainer
                  center={[lat, lng]}
                  zoom={mapDataBounds?.isValid() ? 15 : 14}
                  scrollWheelZoom
                  className="registrar-loc__map"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                  />
                  <FitMapToFarmsOnce bounds={mapDataBounds} />
                  <FlyMapToUserPosition lat={lat} lng={lng} flyNonce={mapFlyToUserNonce} />
                  {fazendasMapa.map((f) => {
                    const poly = parsePolygonLatLng(f.perimetroGeojson);
                    if (poly.length < 3) return null;
                    return (
                      <Polygon
                        key={`fazenda-${f.id}`}
                        positions={poly}
                        pathOptions={{
                          color: '#1f6b3a',
                          weight: 2,
                          dashArray: '12 10',
                          lineCap: 'round',
                          fillColor: '#1f6b3a',
                          fillOpacity: 0.05,
                        }}
                      />
                    );
                  })}
                  {setoresComPoligono.map(({ setor: sec, poly }) => {
                    const cor = corSetorMapa(sec.id);
                    const selecionado = setorChoice === String(sec.id);
                    return (
                      <Polygon
                        key={sec.id}
                        positions={poly}
                        pathOptions={{
                          color: cor,
                          weight: selecionado ? 3 : 2,
                          fillColor: cor,
                          fillOpacity: selecionado ? 0.32 : 0.14,
                        }}
                      />
                    );
                  })}
                  <MapClickPicker
                    onPick={({ lat: pickedLat, lng: pickedLng }) => {
                      const sec = encontrarSetorNoPonto(pickedLat, pickedLng);
                      if (sec) {
                        setSetorChoice(String(sec.id));
                        if (modoMapa === 'setor') {
                          setGeoStatus(`Setor selecionado: ${sec.nome} (${sec.fazendaNome}).`);
                        }
                      } else if (modoMapa === 'setor') {
                          setGeoStatus('Nenhum setor cobre este ponto. Tente outro clique ou use a lista.');
                      }
                      if (modoMapa === 'setor') {
                        return;
                      }
                      setLat(pickedLat);
                      setLng(pickedLng);
                      setGeoStatus(
                        sec
                          ? `Local atualizado e setor selecionado: ${sec.nome}.`
                          : 'Local da ocorrência atualizado.',
                      );
                    }}
                  />
                  <CircleMarker
                    center={[lat, lng]}
                    radius={8}
                    pathOptions={{
                      color: '#fff',
                      fillColor: '#2f6df6',
                      fillOpacity: 1,
                      weight: 2,
                    }}
                  />
                </MapContainer>
              </div>
              <dl className="registrar-loc__coords">
                <div>
                  <dt>Latitude (°)</dt>
                  <dd>
                    <input
                      type="number"
                      step="any"
                      className="registrar-loc__input"
                      value={lat}
                      onChange={(e) => setLat(Number(e.target.value))}
                      aria-label="Latitude em graus"
                    />
                  </dd>
                </div>
                <div>
                  <dt>Longitude (°)</dt>
                  <dd>
                    <input
                      type="number"
                      step="any"
                      className="registrar-loc__input"
                      value={lng}
                      onChange={(e) => setLng(Number(e.target.value))}
                      aria-label="Longitude em graus"
                    />
                  </dd>
                </div>
              </dl>
              {geoStatus ? <p className="muted small">{geoStatus}</p> : null}
              <button type="button" className="btn ghost btn-sm" onClick={capturarLocalizacao}>
                Usar minha localização
              </button>
            </div>
          </section>

          <section className="registrar-card registrar-classificacao">
            <h2 className="registrar-card__title">Classificação e área</h2>
            <p className="muted small registrar-classificacao__lead">
              Se existirem polígonos de setores no mapa acima, use o modo <strong>Escolher setor no mapa</strong> ou
              selecione em <strong>Setor</strong>.
            </p>
            <div className="registrar-classificacao__grid">
              <label className="field">
                <span>Tipo de ocorrência</span>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  required
                >
                  {CATEGORIAS_REGISTRO.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Setor</span>
                <select
                  value={setorChoice}
                  onChange={(e) => setSetorChoice(e.target.value)}
                  aria-label="Setor da ocorrência"
                >
                  {setoresCadastrados.length > 0 ? (
                    setoresCadastrados.map((sec) => (
                      <option key={sec.id} value={String(sec.id)}>
                        {sec.nome} ({sec.fazendaNome})
                      </option>
                    ))
                  ) : (
                    <option value="livre">Sem setores cadastrados — use texto abaixo</option>
                  )}
                  {setoresCadastrados.length > 0 ? (
                    <option value="livre">Outro — descrever em texto</option>
                  ) : null}
                </select>
                {setorSelecionado ? (
                  <span className="registrar-setor__selected muted small">
                    <span
                      className="registrar-setor__dot"
                      style={{ backgroundColor: corSetorMapa(setorSelecionado.id) }}
                      aria-hidden
                    />
                    Selecionado no mapa: {setorSelecionado.nome}
                  </span>
                ) : null}
              </label>
              <label className="field">
                <span>Prioridade</span>
                <select
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value as PrioridadeOcorrencia)}
                  required
                >
                  {PRIORIDADES_REGISTRO.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {setorChoice === 'livre' ? (
              <label className="field registrar-classificacao__full">
                <span>Área / setor (texto)</span>
                <input
                  type="text"
                  value={setor}
                  onChange={(e) => setSetor(e.target.value)}
                  placeholder="Ex.: Talhão 12 — Norte"
                  required
                />
              </label>
            ) : null}
            <label className="field registrar-classificacao__full">
              <span>Título resumido</span>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Foco de pragas na borda do talhão"
                maxLength={200}
                required
              />
            </label>
            <label className="field registrar-classificacao__full">
              <span>Data e hora da ocorrência</span>
              <input
                type="datetime-local"
                value={ocorridoEm}
                onChange={(e) => setOcorridoEm(e.target.value)}
                required
              />
            </label>
          </section>

          <section className="registrar-card">
            <h2 className="registrar-card__title">Evidências visuais</h2>
            <label className="registrar-drop">
              <input
                type="file"
                accept="image/*"
                multiple
                className="registrar-drop__input"
                onChange={handleSelecionarImagens}
              />
              <span className="registrar-drop__cam" aria-hidden />
              <p className="registrar-drop__text muted">
                Clique para selecionar fotos ({imagens.length}/{MAX_UPLOAD_IMAGENS}).
              </p>
              <span className="registrar-drop__hint muted small">
                Formatos comuns (JPG/PNG/WEBP/GIF). Maximo de 10MB por imagem.
              </span>
            </label>
            {imagens.length > 0 ? (
              <ul className="registrar-upload-list">
                {imagens.map((img) => (
                  <li key={img.id} className="registrar-upload-item">
                    <img src={img.previewUrl} alt={img.file.name} className="registrar-upload-item__preview" />
                    <div className="registrar-upload-item__meta">
                      <span title={img.file.name}>{img.file.name}</span>
                      <button
                        type="button"
                        className="btn ghost btn-sm"
                        onClick={() => removerImagem(img.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="registrar-card">
            <h2 className="registrar-card__title">Relato detalhado</h2>
            <label className="field">
              <span>Observações</span>
              <textarea
                rows={4}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva detalhes importantes da ocorrência."
                maxLength={2000}
              />
            </label>
          </section>
        </div>

        <footer className="registrar-page__footer">
          <div className="registrar-page__actions">
            <Link to="/ocorrencias" className="btn ghost">
              Cancelar
            </Link>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar ocorrência'}
            </button>
          </div>
        </footer>

        <p className="registrar-page__legal muted small">
          © {new Date().getFullYear()} Agrolink — Gestão rural inteligente · Suporte · Termos ·
          Privacidade
        </p>
      </form>
    </AppShell>
  );
}
