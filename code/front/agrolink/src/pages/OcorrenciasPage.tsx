import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { SemFazendaAviso } from '../components/SemFazendaAviso';
import { SyncPendingBadge, isOcorrenciaPendingSync } from '../components/SyncPendingBadge';
import { useConnectivity } from '../hooks/useConnectivity';
import { useAuth } from '../auth/AuthContext';
import {
  comentarOcorrencia,
  formatOcorrenciaHorario,
  imagemCategoria,
  labelCategoria,
  resolverOcorrencia,
  prioridadeOcorrencia,
  prioridadeOcorrenciaLabel,
  prioridadeOcorrenciaTone,
  statusOcorrencia,
  statusOcorrenciaLabel,
  statusOcorrenciaTone,
  compararOcorrenciasPorCriticidade,
  normalizarBusca,
  type OcorrenciaDto,
} from '../api/ocorrenciasApi';
import { listOcorrencias } from '../offline/ocorrenciasStore';

const MEDIA_CLASSES = [
  'occ-card__media--a',
  'occ-card__media--b',
  'occ-card__media--c',
  'occ-card__media--d',
] as const;

/**
 * Lista de ocorrências persistidas na API.
 */
export function OcorrenciasPage() {
  const { user, token } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { online, pendingCount, syncVersion } = useConnectivity();
  const [items, setItems] = useState<OcorrenciaDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [commentTargetId, setCommentTargetId] = useState<number | null>(null);
  const [resolveTargetId, setResolveTargetId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ABERTA' | 'RESOLVIDA'>('ABERTA');
  const [tipoFilter, setTipoFilter] = useState('TODOS');
  const [setorFilter, setSetorFilter] = useState('TODOS');
  const [prioridadeFilter, setPrioridadeFilter] = useState<'TODAS' | 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'>('TODAS');
  const [periodoFilter, setPeriodoFilter] = useState<'7' | '30' | '90' | 'ALL'>('ALL');
  const [presetFilter, setPresetFilter] = useState<'NONE' | 'AGUARDANDO'>('NONE');
  const [queuedNotice, setQueuedNotice] = useState(false);
  const semFazenda = user != null && !user.temFazenda;

  useEffect(() => {
    const state = location.state as { offlineQueued?: boolean } | null;
    if (state?.offlineQueued) {
      setQueuedNotice(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (!token || semFazenda) {
      setItems([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    listOcorrencias(token)
      .then(({ items }) => {
        if (!cancelled) setItems(items);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Não foi possível carregar as ocorrências.');
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, syncVersion, semFazenda]);

  useEffect(() => {
    if (syncVersion > 0) setQueuedNotice(false);
  }, [syncVersion]);

  useEffect(() => {
    const preset = (searchParams.get('preset') ?? '').toLowerCase();
    if (preset === 'abertas') {
      setStatusFilter('ABERTA');
      setPrioridadeFilter('TODAS');
      setPresetFilter('NONE');
      setPeriodoFilter('ALL');
      return;
    }
    if (preset === 'resolvidas') {
      setStatusFilter('RESOLVIDA');
      setPrioridadeFilter('TODAS');
      setPresetFilter('NONE');
      setPeriodoFilter('ALL');
      return;
    }
    if (preset === 'criticas') {
      setStatusFilter('TODOS');
      setPrioridadeFilter('URGENTE');
      setPresetFilter('NONE');
      setPeriodoFilter('ALL');
      return;
    }
    if (preset === 'aguardando') {
      setStatusFilter('ABERTA');
      setPrioridadeFilter('TODAS');
      setPresetFilter('AGUARDANDO');
      setPeriodoFilter('ALL');
      return;
    }
    setPresetFilter('NONE');
  }, [searchParams]);

  async function handleResolver(id: number) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      const updated = await resolverOcorrencia(id, token);
      setItems((prev) => (prev ? prev.map((o) => (o.id === id ? updated : o)) : prev));
      setResolveTargetId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível resolver a ocorrência.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleComentar(id: number, textoRaw: string) {
    if (!token) return;
    const texto = textoRaw.trim();
    if (!texto) return;
    setBusyId(id);
    setError(null);
    try {
      const updated = await comentarOcorrencia(id, texto, token);
      setItems((prev) => (prev ? prev.map((o) => (o.id === id ? updated : o)) : prev));
      setCommentTargetId(null);
      setCommentText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar o comentário.');
    } finally {
      setBusyId(null);
    }
  }

  const tiposDisponiveis = Array.from(
    new Set((items ?? []).map((o) => o.categoria.trim().toUpperCase()).filter(Boolean)),
  ).sort();
  const setoresDisponiveis = Array.from(
    new Set((items ?? []).map((o) => o.setor.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filteredItems = (items ?? [])
    .filter((o) => {
    const status = statusOcorrencia(o.status);
    const categoriaKey = o.categoria.trim().toUpperCase();
    const setor = o.setor.trim();

    if (statusFilter !== 'TODOS' && status !== statusFilter) return false;
    if (prioridadeFilter !== 'TODAS' && prioridadeOcorrencia(o.prioridade) !== prioridadeFilter) return false;
    if (tipoFilter !== 'TODOS' && categoriaKey !== tipoFilter) return false;
    if (setorFilter !== 'TODOS' && setor !== setorFilter) return false;
    if (presetFilter === 'AGUARDANDO' && (status !== 'ABERTA' || prioridadeOcorrencia(o.prioridade) === 'URGENTE')) return false;

    if (periodoFilter !== 'ALL') {
      const dias = Number(periodoFilter);
      const t = Date.parse(o.horario);
      if (!Number.isNaN(t)) {
        const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
        if (t < limite) return false;
      }
    }

    const term = normalizarBusca(search);
    if (!term) return true;

    const titulo = normalizarBusca(o.titulo);
    const setorBusca = normalizarBusca(o.setor);
    const categoria = normalizarBusca(labelCategoria(o.categoria));
    const descricao = normalizarBusca(o.descricao ?? '');

    return (
      titulo.includes(term) ||
      String(o.id).includes(term) ||
      setorBusca.includes(term) ||
      categoria.includes(term) ||
      descricao.includes(term)
    );
  })
    .sort(compararOcorrenciasPorCriticidade);

  const pendingOnPage = items?.filter((o) => isOcorrenciaPendingSync(o)).length ?? 0;

  if (semFazenda) {
    return (
      <AppShell>
        <div className="ocorrencias-page">
          <div className="ocorrencias-page__head">
            <div>
              <h1 className="ocorrencias-page__title">Ocorrências</h1>
              <p className="ocorrencias-page__subtitle muted">
                Gerencie e monitore todos os incidentes registrados no campo.
              </p>
            </div>
          </div>
          <SemFazendaAviso papel={user?.papel} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="ocorrencias-page">
        <div className="ocorrencias-page__head">
          <div>
            <h1 className="ocorrencias-page__title">Ocorrências</h1>
            <p className="ocorrencias-page__subtitle muted">
              Gerencie e monitore todos os incidentes registrados no campo.
            </p>
          </div>
          <Link to="/registrar" className="btn primary">
            + Registrar ocorrência
          </Link>
        </div>

        {queuedNotice ? (
          <div className="sync-pending-notice" role="status">
            <SyncPendingBadge variant="banner" />
            <span>Ocorrência salva localmente. Ela será enviada ao servidor quando a conexão voltar.</span>
            <button type="button" className="sync-pending-notice__dismiss" onClick={() => setQueuedNotice(false)} aria-label="Fechar aviso">
              ×
            </button>
          </div>
        ) : null}

        {!online && pendingOnPage > 0 ? (
          <div className="sync-pending-notice sync-pending-notice--offline" role="status">
            <SyncPendingBadge variant="banner" />
            <span>
              {pendingOnPage} ocorrência(s) nesta lista aguardam sincronização
              {pendingCount > pendingOnPage ? ` (${pendingCount} no total na fila)` : ''}.
            </span>
          </div>
        ) : null}

        <div className="ocorrencias-page__filters" aria-label="Filtros (em breve)">
          <input
            type="search"
            className="ocorrencias-page__search"
            placeholder="Pesquisar por título, ID ou descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Pesquisar ocorrências"
          />
          <select className="ocorrencias-page__select" value={statusFilter} onChange={(e) => { setPresetFilter('NONE'); setStatusFilter(e.target.value as 'TODOS' | 'ABERTA' | 'RESOLVIDA'); }}>
            <option value="TODOS">Todos status</option>
            <option value="ABERTA">Abertas</option>
            <option value="RESOLVIDA">Resolvidas</option>
          </select>
          <select
            className="ocorrencias-page__select"
            value={prioridadeFilter}
            onChange={(e) => { setPresetFilter('NONE'); setPrioridadeFilter(e.target.value as 'TODAS' | 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'); }}
          >
            <option value="TODAS">Todas prioridades</option>
            <option value="BAIXA">Baixa</option>
            <option value="MEDIA">Média</option>
            <option value="ALTA">Alta</option>
            <option value="URGENTE">Crítica</option>
          </select>
          <select className="ocorrencias-page__select" value={tipoFilter} onChange={(e) => { setPresetFilter('NONE'); setTipoFilter(e.target.value); }}>
            <option value="TODOS">Todos tipos</option>
            {tiposDisponiveis.map((tipo) => (
              <option key={tipo} value={tipo}>
                {labelCategoria(tipo)}
              </option>
            ))}
          </select>
          <select className="ocorrencias-page__select" value={setorFilter} onChange={(e) => { setPresetFilter('NONE'); setSetorFilter(e.target.value); }}>
            <option value="TODOS">Todas as áreas</option>
            {setoresDisponiveis.map((setor) => (
              <option key={setor} value={setor}>
                {setor}
              </option>
            ))}
          </select>
          <select className="ocorrencias-page__select" value={periodoFilter} onChange={(e) => { setPresetFilter('NONE'); setPeriodoFilter(e.target.value as '7' | '30' | '90' | 'ALL'); }}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="ALL">Todo período</option>
          </select>
        </div>

        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}

        {items === null ? (
          <p className="muted">Carregando ocorrências…</p>
        ) : filteredItems.length === 0 ? (
          <p className="muted">Nenhuma ocorrência registrada ainda. Use &quot;Registrar ocorrência&quot; para criar a primeira.</p>
        ) : (
          <ul className="ocorrencias-page__grid">
            {filteredItems.map((o, index) => {
              const prioridade = prioridadeOcorrencia(o.prioridade);
              const status = statusOcorrencia(o.status);
              const imagemPrincipal = o.imagens?.[0] ?? imagemCategoria(o.categoria);
              const syncPending = isOcorrenciaPendingSync(o);
              return (
                <li key={o.clientUuid ?? o.id}>
                  <article className={`occ-card${syncPending ? ' occ-card--sync-pending' : ''}`}>
                    <div
                      className={`occ-card__media ${MEDIA_CLASSES[index % MEDIA_CLASSES.length]}`}
                      aria-hidden
                      style={{
                        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.14), rgba(0,0,0,0.18)), url("${imagemPrincipal}")`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      <div className="occ-card__badges">
                        <span className={`occ-card__status occ-card__status--${statusOcorrenciaTone(status)}`}>
                          {statusOcorrenciaLabel(status)}
                        </span>
                        <span className={`occ-card__prio occ-card__prio--${prioridadeOcorrenciaTone(prioridade)}`}>
                          {prioridadeOcorrenciaLabel(prioridade)}
                        </span>
                      </div>
                      {syncPending ? (
                        <div className="occ-card__sync-ribbon">
                          <SyncPendingBadge />
                        </div>
                      ) : null}
                    </div>
                    <div className="occ-card__body">
                      <p className="occ-card__meta muted small">
                        {labelCategoria(o.categoria)} · {syncPending ? 'local' : `#${o.id}`}
                      </p>
                      <h2 className="occ-card__title">{o.titulo}</h2>
                      <p className="occ-card__local muted small">{o.setor}</p>
                      <p className="occ-card__desc">
                        Lat {o.coordsY.toFixed(5)}°, lon {o.coordsX.toFixed(5)}°
                      </p>
                      <dl className="occ-card__dl">
                        <div>
                          <dt>Registrado</dt>
                          <dd>{formatOcorrenciaHorario(o.horario)}</dd>
                        </div>
                      </dl>
                      <div className="occ-card__actions">
                        <button
                          type="button"
                          className="btn ghost btn-sm"
                          onClick={() => setCommentTargetId(o.id)}
                          disabled={busyId === o.id || syncPending}
                          title={syncPending ? 'Disponível após sincronizar' : undefined}
                        >
                          Comentar
                        </button>
                        <button
                          type="button"
                          className="btn primary btn-sm"
                          onClick={() => setResolveTargetId(o.id)}
                          disabled={busyId === o.id || status === 'RESOLVIDA' || syncPending}
                          title={syncPending ? 'Disponível após sincronizar' : undefined}
                        >
                          Resolver
                        </button>
                        {syncPending ? (
                          <span className="occ-card__sync-hint muted small">Sync pendente</span>
                        ) : (
                        <Link
                          to={`/ocorrencias/${o.id}`}
                          className="btn btn-sm occ-card__open"
                          aria-label={`Abrir detalhes: ${o.titulo}`}
                        >
                          Abrir
                          <span className="occ-card__open-arrow" aria-hidden>
                            →
                          </span>
                        </Link>
                        )}
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        <div className="ocorrencias-page__load">
          <p className="muted small">
            {items === null
              ? '…'
              : filteredItems.length === 0
                ? 'Nenhum registro'
                : `Exibindo ${filteredItems.length} ocorrência${filteredItems.length === 1 ? '' : 's'}`}
          </p>
          <button type="button" className="btn ghost" disabled title="Em breve">
            Carregar mais registros
          </button>
        </div>

        <footer className="ocorrencias-page__legal muted small">
          © {new Date().getFullYear()} Agrolink — Gestão rural inteligente ·{' '}
          <span>Suporte</span> · <span>Termos</span> · <span>Privacidade</span>
        </footer>
      </div>
      {commentTargetId !== null ? (
        <div className="equipe-modal" role="dialog" aria-modal="true" aria-label="Comentar ocorrência">
          <button className="equipe-modal__backdrop" type="button" onClick={() => setCommentTargetId(null)} />
          <div className="equipe-modal__panel">
            <div className="equipe-modal__head">
              <div className="equipe-modal__head-text">
                <h3 className="equipe-modal__title">Comentar ocorrência #{commentTargetId}</h3>
              </div>
              <button className="equipe-modal__close" type="button" onClick={() => setCommentTargetId(null)}>
                ×
              </button>
            </div>
            <div className="equipe-modal__fields">
              <label className="field">
                <span>Comentário</span>
                <textarea rows={4} value={commentText} onChange={(e) => setCommentText(e.target.value)} />
              </label>
            </div>
            <div className="equipe-modal__footer">
              <button className="btn ghost" type="button" onClick={() => setCommentTargetId(null)}>
                Cancelar
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => handleComentar(commentTargetId, commentText)}
                disabled={busyId === commentTargetId || !commentText.trim()}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {resolveTargetId !== null ? (
        <div className="equipe-modal" role="dialog" aria-modal="true" aria-label="Confirmar resolução">
          <button className="equipe-modal__backdrop" type="button" onClick={() => setResolveTargetId(null)} />
          <div className="equipe-modal__panel">
            <div className="equipe-modal__head">
              <div className="equipe-modal__head-text">
                <h3 className="equipe-modal__title">Confirmar resolução</h3>
              </div>
              <button className="equipe-modal__close" type="button" onClick={() => setResolveTargetId(null)}>
                ×
              </button>
            </div>
            <div className="equipe-modal__fields">
              <p className="muted">Tem certeza que deseja marcar esta ocorrência como resolvida?</p>
            </div>
            <div className="equipe-modal__footer">
              <button className="btn ghost" type="button" onClick={() => setResolveTargetId(null)}>
                Cancelar
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => handleResolver(resolveTargetId)}
                disabled={busyId === resolveTargetId}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
