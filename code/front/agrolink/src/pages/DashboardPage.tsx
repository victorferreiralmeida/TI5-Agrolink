import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useConnectivity } from '../hooks/useConnectivity';
import { AppShell } from '../components/AppShell';
import { SemFazendaAviso } from '../components/SemFazendaAviso';
import { labelCategoria, prioridadeOcorrencia, statusOcorrencia, type OcorrenciaDto, compararOcorrenciasPorCriticidade } from '../api/ocorrenciasApi';
import { listOcorrencias } from '../offline/ocorrenciasStore';
import { fetchEquipeResumo } from '../api/equipeApi';
import { papelContaLabel } from '../utils/papelConta';
import { DashboardFarmMap } from '../components/DashboardFarmMap';

type FiltroDash = 'hoje' | 'semana' | 'importante' | 'arquivados';

type RecentOcc = {
  id: string;
  titulo: string;
  local: string;
  categoria: string;
  reporter: string;
  statusLabel: string;
  statusTone: 'critica' | 'aberta' | 'pendente' | 'resolvida';
  mediaClass: string;
};

export function DashboardPage() {
  const { user, token } = useAuth();
  const { syncVersion } = useConnectivity();
  const [filtro, setFiltro] = useState<FiltroDash>('hoje');
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaDto[] | null>(null);
  const [equipe, setEquipe] = useState<Awaited<ReturnType<typeof fetchEquipeResumo>> | null>(null);
  const [healthStatus, setHealthStatus] = useState<'UP' | 'DOWN'>('DOWN');
  const [error, setError] = useState<string | null>(null);

  const semFazenda = user != null && !user.temFazenda;
  const saudacao = papelContaLabel(user?.papel);

  useEffect(() => {
    if (!token || semFazenda) {
      setOcorrencias([]);
      setEquipe(null);
      return;
    }
    let cancelled = false;
    setError(null);
    Promise.all([
      listOcorrencias(token).then((r) => r.items),
      fetchEquipeResumo(token).catch(() => null),
      fetch('/api/health')
        .then((r) => (r.ok ? r.json() : { status: 'DOWN' }))
        .catch(() => ({ status: 'DOWN' as const })),
    ])
      .then(([ocs, eq, health]) => {
        if (cancelled) return;
        setOcorrencias(ocs);
        setEquipe(eq);
        setHealthStatus(health?.status === 'UP' ? 'UP' : 'DOWN');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Não foi possível carregar o dashboard.');
        setOcorrencias([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, syncVersion, semFazenda]);

  const kpis = useMemo(() => {
    const items = ocorrencias ?? [];
    const abertas = items.filter((o) => statusOcorrencia(o.status) === 'ABERTA').length;
    const resolvidas = items.filter((o) => statusOcorrencia(o.status) === 'RESOLVIDA').length;
    const criticas = items.filter((o) => prioridadeOcorrencia(o.prioridade) === 'URGENTE').length;
    const aguardando = items.filter((o) => statusOcorrencia(o.status) === 'ABERTA' && prioridadeOcorrencia(o.prioridade) !== 'URGENTE').length;
    return { abertas, aguardando, resolvidas, criticas };
  }, [ocorrencias]);

  const recentes = useMemo<RecentOcc[]>(() => {
    const todas = ocorrencias ?? [];
    const filtradas = todas.filter((o) => {
      const t = Date.parse(o.horario);
      if (filtro === 'hoje') return !Number.isNaN(t) && t >= Date.now() - 24 * 60 * 60 * 1000;
      if (filtro === 'semana') return !Number.isNaN(t) && t >= Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (filtro === 'importante') {
        const p = prioridadeOcorrencia(o.prioridade);
        return p === 'URGENTE' || p === 'ALTA';
      }
      return statusOcorrencia(o.status) === 'RESOLVIDA';
    });

    const base = [...filtradas].sort(compararOcorrenciasPorCriticidade).slice(0, 8);

    return base.map((o, idx) => {
      const status = statusOcorrencia(o.status);
      const prio = prioridadeOcorrencia(o.prioridade);
      return {
        id: `OC-${String(o.id).padStart(4, '0')}`,
        titulo: o.titulo,
        local: o.setor,
        categoria: labelCategoria(o.categoria),
        reporter: ultimoAutorComentario(o.comentarios),
        statusLabel: status === 'RESOLVIDA' ? 'Resolvida' : prio === 'URGENTE' ? 'Crítica' : 'Aberta',
        statusTone: status === 'RESOLVIDA' ? 'resolvida' : prio === 'URGENTE' ? 'critica' : 'aberta',
        mediaClass: `dash-recent__thumb--${String.fromCharCode(97 + (idx % 4))}`,
      };
    });
  }, [ocorrencias, filtro]);

  const notificacoes = useMemo(() => {
    const items = [...(ocorrencias ?? [])].sort((a, b) => Date.parse(b.horario) - Date.parse(a.horario)).slice(0, 2);
    return items.map((o) => ({ id: o.id, label: `${o.titulo} · ${tempoRelativo(o.horario)}` }));
  }, [ocorrencias]);

  return (
    <AppShell>
      <div className="dash-page">
        <header className="dash-page__head">
          <div className="dash-page__intro">
            <h1 className="dash-page__title">Dashboard</h1>
            <p className="dash-page__subtitle muted">
              Bem-vindo de volta, {saudacao}.
              {user?.temFazenda ? ' Veja o resumo da sua fazenda.' : ' Complete seu vínculo para começar.'}
            </p>
          </div>
          <div className="dash-page__head-actions">
            <label className="dash-page__period">
              <span className="visually-hidden">Período</span>
              <select className="dash-page__period-select" value={filtro} onChange={(e) => setFiltro(e.target.value as FiltroDash)} aria-label="Período">
                <option value="hoje">Hoje</option>
                <option value="semana">Esta semana</option>
                <option value="importante">Importante</option>
                <option value="arquivados">Arquivados</option>
              </select>
            </label>
            <Link to="/registrar" className="btn primary dash-page__cta-reg">
              + Registrar ocorrência
            </Link>
          </div>
        </header>

        <div className="dash-page__layout">
          <div className="dash-page__main">
            {semFazenda ? <SemFazendaAviso papel={user?.papel} /> : null}
            {!semFazenda ? (
            <>
            <section className="dash-kpis" aria-label="Indicadores">
              <Link to="/ocorrencias?preset=abertas" className="dash-kpi dash-kpi--aberta">
                <span className="dash-kpi__icon" aria-hidden>
                  ℹ
                </span>
                <div>
                  <p className="dash-kpi__label muted small">Total aberta</p>
                  <p className="dash-kpi__value">{kpis.abertas}</p>
                </div>
              </Link>
              <Link to="/ocorrencias?preset=aguardando" className="dash-kpi dash-kpi--aguardando">
                <span className="dash-kpi__icon" aria-hidden>
                  🕐
                </span>
                <div>
                  <p className="dash-kpi__label muted small">Aguardando</p>
                  <p className="dash-kpi__value">{kpis.aguardando}</p>
                </div>
              </Link>
              <Link to="/ocorrencias?preset=resolvidas" className="dash-kpi dash-kpi--resolvida">
                <span className="dash-kpi__icon" aria-hidden>
                  ✓
                </span>
                <div>
                  <p className="dash-kpi__label muted small">Resolvidas</p>
                  <p className="dash-kpi__value">{kpis.resolvidas}</p>
                </div>
              </Link>
              <Link to="/ocorrencias?preset=criticas" className="dash-kpi dash-kpi--critica">
                <span className="dash-kpi__icon" aria-hidden>
                  ⚠
                </span>
                <div>
                  <p className="dash-kpi__label muted small">Críticas</p>
                  <p className="dash-kpi__value">{kpis.criticas}</p>
                </div>
              </Link>
            </section>
            {error ? (
              <p className="error-text" role="alert">
                {error}
              </p>
            ) : null}

            <section className="dash-recent" aria-labelledby="dash-recent-title">
              <div className="dash-recent__toolbar">
                <h2 id="dash-recent-title" className="dash-recent__heading">
                  Ocorrências recentes
                </h2>
                <div className="dash-recent__filters" role="group" aria-label="Filtros da lista">
                  {(
                    [
                      { id: 'hoje' as const, label: 'Hoje' },
                      { id: 'semana' as const, label: 'Esta semana' },
                      { id: 'importante' as const, label: 'Importante' },
                      { id: 'arquivados' as const, label: 'Arquivados' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`dash-recent__chip${filtro === f.id ? ' dash-recent__chip--active' : ''}`}
                      onClick={() => setFiltro(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <Link to="/ocorrencias" className="dash-recent__ver-tudo">
                  Ver tudo ›
                </Link>
              </div>

              <ul className="dash-recent__list">
                {recentes.map((o) => (
                  <li key={o.id} className="dash-recent__row">
                    <div className={`dash-recent__thumb ${o.mediaClass}`} aria-hidden />
                    <div className="dash-recent__body">
                      <div className="dash-recent__top">
                        <span className={`dash-recent__badge dash-recent__badge--${o.statusTone}`}>{o.statusLabel}</span>
                        <span className="dash-recent__id muted small">{o.id}</span>
                      </div>
                      <h3 className="dash-recent__titulo">{o.titulo}</h3>
                      <p className="dash-recent__meta muted small">
                        {o.categoria} · {o.local}
                      </p>
                      <div className="dash-recent__footer">
                        <span className="dash-recent__reporter">
                          <span className="dash-recent__reporter-av" aria-hidden />
                          {o.reporter}
                        </span>
                        <Link to="/ocorrencias" className="dash-recent__detalhe">
                          Ver detalhes →
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
                {ocorrencias !== null && recentes.length === 0 ? (
                  <li className="dash-recent__row">
                    <div className="dash-recent__body">
                      <p className="muted small">Nenhuma ocorrência para este filtro.</p>
                    </div>
                  </li>
                ) : null}
              </ul>

              <div className="dash-recent__load">
                <Link to="/ocorrencias" className="btn ghost">
                  Ver lista completa
                </Link>
              </div>
            </section>
            </>
            ) : null}
          </div>

          <aside className="dash-aside" aria-label="Atalhos e resumo">
            {!semFazenda ? (
            <>
            <section className="dash-widget">
              <h3 className="dash-widget__title">Mapa da fazenda</h3>
              <DashboardFarmMap token={token} ocorrencias={ocorrencias ?? []} gerenteSemFazenda={false} />
              <Link to="/mapa" className="dash-widget__link">
                Abrir mapa
              </Link>
            </section>

            <section className="dash-widget">
              <div className="dash-widget__head">
                <h3 className="dash-widget__title">Notificações</h3>
                <Link to="/notificacoes" className="dash-widget__link-inline">
                  Ver todas
                </Link>
              </div>
              <ul className="dash-widget__notifs">
                {notificacoes.map((n) => (
                  <li key={n.id} className="muted small">
                    {n.label}
                  </li>
                ))}
                {notificacoes.length === 0 ? <li className="muted small">Sem notificações no momento.</li> : null}
              </ul>
              <button type="button" className="dash-widget__clear muted small" disabled title="Em breve">
                Limpar notificações
              </button>
            </section>

            <div className="dash-widget dash-widget--actions">
              <Link to="/mensagens" className="btn ghost dash-widget__btn-chat">
                💬 Abrir chat rural
              </Link>
            </div>

            <section className="dash-widget dash-widget--status">
              <p className="dash-widget__status-title">{healthStatus === 'UP' ? 'Sistema online' : 'Sistema indisponível'}</p>
              <p className="muted small">
                Última sincronização: {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
              {equipe ? <p className="muted small">Equipe ativa: {equipe.membros.length} membros</p> : null}
            </section>
            </>
            ) : (
              <section className="dash-widget">
                <h3 className="dash-widget__title">Próximos passos</h3>
                <SemFazendaAviso papel={user?.papel} />
              </section>
            )}
          </aside>
        </div>

        <footer className="dash-page__footer muted small">
          <span>© 2026 AGROLINK — Gestão rural inteligente</span>
          <span className="dash-page__footer-links">
            <span>Suporte</span>
            <span>·</span>
            <span>Termos de uso</span>
            <span>·</span>
            <span>Privacidade</span>
          </span>
        </footer>
      </div>
    </AppShell>
  );
}

function ultimoAutorComentario(comentarios: string | null): string {
  if (!comentarios || !comentarios.trim()) return 'Equipe campo';
  const linhas = comentarios.trim().split('\n');
  const ultima = linhas[linhas.length - 1] ?? '';
  const idx = ultima.indexOf('] ');
  if (idx >= 0) {
    const resto = ultima.slice(idx + 2);
    const doisPontos = resto.indexOf(':');
    if (doisPontos > 0) return resto.slice(0, doisPontos).trim();
  }
  return 'Equipe campo';
}

function tempoRelativo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'agora';
  const diffMin = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (diffMin < 60) return `há ${diffMin} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}
