import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../auth/AuthContext';
import {
  criarSetorFazenda,
  fetchMinhaFazenda,
  removerSetorFazenda,
  salvarMinhaFazenda,
  type FazendaDto,
  type FazendaSetorDto,
} from '../api/fazendaApi';
import { corSetorMapa, QTD_CORES_SETOR_MAPA } from '../geo/fazendaMapGeometry';

const DEFAULT_LAT = -19.9191;
const DEFAULT_LNG = -43.9387;
type LatLng = [number, number];

function MapClickPicker({ onPick }: { onPick: (point: LatLng) => void }) {
  useMapEvents({
    click: (e) => onPick([e.latlng.lat, e.latlng.lng]),
  });
  return null;
}

function parsePolygon(raw: string | null): LatLng[] {
  if (!raw?.trim()) return [];
  try {
    const j = JSON.parse(raw) as { type?: string; coordinates?: unknown };
    if (j.type !== 'Polygon' || !Array.isArray(j.coordinates) || j.coordinates.length === 0) return [];
    const firstRing = j.coordinates[0];
    if (!Array.isArray(firstRing)) return [];
    const points: LatLng[] = [];
    for (const item of firstRing) {
      if (!Array.isArray(item) || item.length < 2) continue;
      const lng = item[0];
      const lat = item[1];
      if (typeof lat === 'number' && typeof lng === 'number') {
        points.push([lat, lng]);
      }
    }
    // Remove possível ponto repetido no fim (fechamento do GeoJSON).
    if (points.length >= 2) {
      const [aLat, aLng] = points[0];
      const [bLat, bLng] = points[points.length - 1];
      if (aLat === bLat && aLng === bLng) points.pop();
    }
    return points;
  } catch {
    return [];
  }
}

function toPolygonGeoJson(points: LatLng[]): string {
  const ring = points.map(([lat, lng]) => [lng, lat]);
  const closed = [...ring, ring[0]];
  return JSON.stringify({ type: 'Polygon', coordinates: [closed] });
}

export function FazendaPage() {
  const { token, user, refreshUsuario } = useAuth();
  const [nome, setNome] = useState('');
  const [fazenda, setFazenda] = useState<FazendaDto | null>(null);
  const [fazendaPoligono, setFazendaPoligono] = useState<LatLng[]>([]);
  const [setorPoligono, setSetorPoligono] = useState<LatLng[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fazendaError, setFazendaError] = useState<string | null>(null);
  const [setorError, setSetorError] = useState<string | null>(null);
  const [novoSetorNome, setNovoSetorNome] = useState('');
  const [addingSetor, setAddingSetor] = useState(false);
  const mapCenter = useMemo<LatLng>(() => fazendaPoligono[0] ?? [DEFAULT_LAT, DEFAULT_LNG], [fazendaPoligono]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFazendaError(null);
    try {
      const f = await fetchMinhaFazenda(token);
      setFazenda(f);
      if (f) {
        setNome(f.nome);
        setFazendaPoligono(parsePolygon(f.perimetroGeojson));
      } else {
        setNome('');
        setFazendaPoligono([]);
      }
    } catch (e) {
      setFazendaError(e instanceof Error ? e.message : 'Não foi possível carregar a fazenda.');
      setFazenda(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSalvarFazenda(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const n = nome.trim();
    if (!n) {
      setFazendaError('Informe o nome da fazenda.');
      return;
    }
    if (fazendaPoligono.length < 3) {
      setFazendaError('Desenhe o perímetro da fazenda no mapa com ao menos 3 pontos.');
      return;
    }
    setSaving(true);
    setFazendaError(null);
    try {
      const perimetro = toPolygonGeoJson(fazendaPoligono);
      const salva = await salvarMinhaFazenda(token, { nome: n, perimetroGeojson: perimetro });
      setFazenda(salva);
      await refreshUsuario();
    } catch (err) {
      setFazendaError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdicionarSetor(e: FormEvent) {
    e.preventDefault();
    if (!token || !fazenda) return;
    const n = novoSetorNome.trim();
    if (!n) {
      setSetorError('Informe o nome do setor.');
      return;
    }
    setAddingSetor(true);
    setSetorError(null);
    try {
      await criarSetorFazenda(token, {
        nome: n,
        poligonoGeojson: setorPoligono.length >= 3 ? toPolygonGeoJson(setorPoligono) : null,
      });
      setNovoSetorNome('');
      setSetorPoligono([]);
      await reload();
    } catch (err) {
      setSetorError(err instanceof Error ? err.message : 'Falha ao criar setor.');
    } finally {
      setAddingSetor(false);
    }
  }

  async function handleRemoverSetor(s: FazendaSetorDto) {
    if (!token || !window.confirm(`Remover o setor “${s.nome}”?`)) return;
    setSetorError(null);
    try {
      await removerSetorFazenda(token, s.id);
      await reload();
    } catch (err) {
      setSetorError(err instanceof Error ? err.message : 'Falha ao remover.');
    }
  }

  if (user?.papel !== 'GERENTE') {
    return (
      <AppShell>
        <div className="fazenda-page">
          <p className="muted">Apenas o perfil <strong>Gerente</strong> cadastra a fazenda e os setores.</p>
          <Link to="/dashboard" className="btn ghost">
            Voltar ao painel
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="fazenda-page">
        <div className="fazenda-page__head">
          <Link to="/dashboard" className="fazenda-page__back">
            ← Painel
          </Link>
          <h1 className="fazenda-page__title">Minha fazenda</h1>
          <p className="muted small">
            Defina o nome da propriedade e desenhe o <strong>perímetro da fazenda</strong> no mapa.
            Depois cadastre os <strong>setores</strong> desenhando os polígonos manualmente.
          </p>
        </div>

        {loading ? (
          <p className="muted">Carregando…</p>
        ) : (
          <form className="fazenda-page__form" onSubmit={handleSalvarFazenda}>
            <section className="registrar-card">
              <h2 className="registrar-card__title">Dados da fazenda</h2>
              <label className="field">
                <span>Nome da fazenda</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Fazenda Santa Helena"
                  maxLength={200}
                  required
                />
              </label>
              <p className="muted small registrar-loc__hint">
                Clique no mapa para adicionar os pontos do perímetro da fazenda.
              </p>
              {fazendaError ? (
                <p className="error-text fazenda-page__alert" role="alert">
                  {fazendaError}
                </p>
              ) : null}
              <div className="fazenda-page__draw-actions">
                <button type="button" className="btn ghost btn-sm" onClick={() => setFazendaPoligono((prev) => prev.slice(0, -1))} disabled={fazendaPoligono.length === 0}>
                  Desfazer ponto
                </button>
                <button type="button" className="btn ghost btn-sm" onClick={() => setFazendaPoligono([])} disabled={fazendaPoligono.length === 0}>
                  Limpar desenho
                </button>
                <span className="muted small">{fazendaPoligono.length} ponto(s)</span>
              </div>
              <div className="registrar-loc__map-wrap">
                <MapContainer center={mapCenter} zoom={14} scrollWheelZoom className="registrar-loc__map">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapClickPicker onPick={(point) => setFazendaPoligono((prev) => [...prev, point])} />
                  {fazendaPoligono.length >= 1 ? <CircleMarker center={fazendaPoligono[0]} radius={6} pathOptions={{ color: '#1f6b3a', fillColor: '#1f6b3a', fillOpacity: 0.95 }} /> : null}
                  {fazendaPoligono.length >= 2 ? <Polyline positions={fazendaPoligono} pathOptions={{ color: '#1f6b3a', weight: 3 }} /> : null}
                  {fazendaPoligono.length >= 3 ? <Polygon positions={fazendaPoligono} pathOptions={{ color: '#1f6b3a', fillColor: '#4caf6a', fillOpacity: 0.18 }} /> : null}
                  {fazenda?.setores.map((s) => {
                    const poly = parsePolygon(s.poligonoGeojson);
                    if (poly.length < 3) return null;
                    const cor = corSetorMapa(s.id);
                    return (
                      <Polygon
                        key={s.id}
                        positions={poly}
                        pathOptions={{ color: cor, weight: 2, fillColor: cor, fillOpacity: 0.16 }}
                      />
                    );
                  })}
                </MapContainer>
              </div>
              <p className="muted small">No mínimo 3 pontos para salvar o perímetro.</p>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'Salvando…' : fazenda ? 'Atualizar fazenda' : 'Salvar fazenda'}
              </button>
            </section>
          </form>
        )}

        {fazenda ? (
          <section className="registrar-card fazenda-page__setores">
            <h2 className="registrar-card__title">Setores</h2>
            {fazenda.setores.length === 0 ? <p className="muted small">Nenhum setor ainda. Adicione abaixo.</p> : null}
            <p className="muted small fazenda-page__setor-legend">
              A cor ao lado de cada setor é a mesma usada no mapa ({QTD_CORES_SETOR_MAPA} cores distintas; a partir do{' '}
              {QTD_CORES_SETOR_MAPA + 1}º setor cadastrado no sistema, as cores podem voltar a aparecer conforme o id).
            </p>
            <ul className="fazenda-page__setor-list">
              {fazenda.setores.map((s) => {
                const cor = corSetorMapa(s.id);
                const temPoligono = Boolean(s.poligonoGeojson?.trim());
                return (
                  <li
                    key={s.id}
                    className="fazenda-page__setor-item"
                    style={{ borderLeft: `4px solid ${cor}` }}
                  >
                    <div className="fazenda-page__setor-info">
                      <span
                        className="fazenda-page__setor-color"
                        style={{ backgroundColor: cor }}
                        title={`Cor no mapa: ${cor}`}
                        aria-hidden
                      />
                      <div>
                        <strong>{s.nome}</strong>
                        {temPoligono ? (
                          <span className="muted small"> · polígono definido</span>
                        ) : (
                          <span className="muted small"> · sem polígono no mapa</span>
                        )}
                      </div>
                    </div>
                    <button type="button" className="btn ghost btn-sm" onClick={() => void handleRemoverSetor(s)}>
                      Remover
                    </button>
                  </li>
                );
              })}
            </ul>
            <form className="fazenda-page__novo-setor" onSubmit={handleAdicionarSetor}>
              <label className="field">
                <span>Novo setor</span>
                <input
                  value={novoSetorNome}
                  onChange={(e) => setNovoSetorNome(e.target.value)}
                  placeholder="Ex.: Talhão Norte"
                  maxLength={100}
                />
              </label>
              {setorError ? (
                <p className="error-text fazenda-page__alert" role="alert">
                  {setorError}
                </p>
              ) : null}
              <p className="muted small">Desenhe o setor clicando no mapa. Opcional: se não desenhar, setor fica sem polígono.</p>
              <div className="fazenda-page__draw-actions">
                <button type="button" className="btn ghost btn-sm" onClick={() => setSetorPoligono((prev) => prev.slice(0, -1))} disabled={setorPoligono.length === 0}>
                  Desfazer ponto
                </button>
                <button type="button" className="btn ghost btn-sm" onClick={() => setSetorPoligono([])} disabled={setorPoligono.length === 0}>
                  Limpar desenho
                </button>
                <span className="muted small">{setorPoligono.length} ponto(s)</span>
              </div>
              <div className="registrar-loc__map-wrap">
                <MapContainer center={mapCenter} zoom={15} scrollWheelZoom className="registrar-loc__map">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {/* Setores já existentes (referência para não desenhar sobreposto). */}
                  {fazenda?.setores.map((s) => {
                    const poly = parsePolygon(s.poligonoGeojson);
                    if (poly.length < 3) return null;
                    const cor = corSetorMapa(s.id);
                    return (
                      <Polygon
                        key={`existente-${s.id}`}
                        positions={poly}
                        pathOptions={{
                          color: cor,
                          weight: 2,
                          fillColor: cor,
                          fillOpacity: 0.14,
                          dashArray: '8 6',
                        }}
                      />
                    );
                  })}
                  <MapClickPicker onPick={(point) => setSetorPoligono((prev) => [...prev, point])} />
                  {setorPoligono.length >= 1 ? <CircleMarker center={setorPoligono[0]} radius={6} pathOptions={{ color: '#114f9f', fillColor: '#114f9f', fillOpacity: 0.95 }} /> : null}
                  {setorPoligono.length >= 2 ? <Polyline positions={setorPoligono} pathOptions={{ color: '#114f9f', weight: 3 }} /> : null}
                  {setorPoligono.length >= 3 ? <Polygon positions={setorPoligono} pathOptions={{ color: '#114f9f', fillColor: '#3d85db', fillOpacity: 0.2 }} /> : null}
                  {fazendaPoligono.length >= 3 ? <Polygon positions={fazendaPoligono} pathOptions={{ color: '#1f6b3a', fillColor: '#4caf6a', fillOpacity: 0.08 }} /> : null}
                </MapContainer>
              </div>
              <button type="submit" className="btn primary" disabled={addingSetor}>
                {addingSetor ? 'Adicionando…' : 'Adicionar setor'}
              </button>
            </form>
          </section>
        ) : !loading ? (
          <p className="muted small fazenda-page__hint">
            Salve a fazenda acima para liberar o cadastro de setores.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
