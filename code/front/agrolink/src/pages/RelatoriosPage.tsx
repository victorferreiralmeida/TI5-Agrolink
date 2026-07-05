import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { SemFazendaAviso } from '../components/SemFazendaAviso';
import { useAuth } from '../auth/AuthContext';
import { useConnectivity } from '../hooks/useConnectivity';
import { useLoading } from '../loading/LoadingContext';
import { fetchMapaRegistroOcorrencia, fetchMinhaFazenda } from '../api/fazendaApi';
import { labelCategoria, prioridadeOcorrencia, statusOcorrencia, type OcorrenciaDto } from '../api/ocorrenciasApi';
import { listOcorrencias } from '../offline/ocorrenciasStore';
import { parsePolygonLatLng } from '../geo/fazendaMapGeometry';
import {
  buildRelatorioMapPngAsync,
  RELATORIO_MAPA_EXPORT_SIZE,
  type FazendaPoligonoRelatorio,
  type SetorPoligonoRelatorio,
} from '../utils/relatorioMapCanvas';

type Periodo = '7d' | '30d';

type GeometriaRelatorio = {
  fazendas: FazendaPoligonoRelatorio[];
  setores: SetorPoligonoRelatorio[];
};

function layersParaMapaRelatorio(geometriaMapa: GeometriaRelatorio | null, ocorrencias: OcorrenciaDto[]) {
  return {
    fazendas: geometriaMapa?.fazendas ?? [],
    setores: geometriaMapa?.setores ?? [],
    ocorrencias: ocorrencias.map((o) => ({
      lat: o.coordsY,
      lng: o.coordsX,
      categoria: o.categoria,
    })),
  };
}

const BAR_MAX_HEIGHT = 160;
export function RelatoriosPage() {
  const { token, user } = useAuth();
  const { syncVersion } = useConnectivity();
  const { runWithLoading } = useLoading();
  const [periodo, setPeriodo] = useState<Periodo>('7d');
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaDto[]>([]);
  const [geometriaMapa, setGeometriaMapa] = useState<GeometriaRelatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [tipoFilter, setTipoFilter] = useState<string>('TODOS');
  const [areaFilter, setAreaFilter] = useState<string>('TODOS');
  const [prioridadeFilter, setPrioridadeFilter] = useState<'TODAS' | 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'>('TODAS');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ABERTA' | 'RESOLVIDA'>('TODOS');
  const [animTick, setAnimTick] = useState(0);
  const [mapaPreviewUrl, setMapaPreviewUrl] = useState<string | null>(null);
  const [mapaPreviewLoading, setMapaPreviewLoading] = useState(false);
  const semFazenda = user != null && !user.temFazenda;

  useEffect(() => {
    if (!token || semFazenda) {
      setOcorrencias([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    listOcorrencias(token)
      .then(({ items: data }) => {
        if (!active) return;
        setOcorrencias(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Falha ao carregar relatórios.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, syncVersion, semFazenda]);

  useEffect(() => {
    if (!token || !user || semFazenda) {
      setGeometriaMapa(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        if (user.papel === 'GERENTE') {
          const f = await fetchMinhaFazenda(token);
          if (!active) return;
          if (!f) {
            setGeometriaMapa(null);
            return;
          }
          setGeometriaMapa({
            fazendas: [{ nome: f.nome, poly: parsePolygonLatLng(f.perimetroGeojson) }],
            setores: f.setores.map((s) => ({
              id: s.id,
              nome: s.nome,
              poly: parsePolygonLatLng(s.poligonoGeojson),
            })),
          });
          return;
        }
        const reg = await fetchMapaRegistroOcorrencia(token);
        if (!active) return;
        setGeometriaMapa({
          fazendas: reg.fazendas.map((fz) => ({
            nome: fz.nome,
            poly: parsePolygonLatLng(fz.perimetroGeojson),
          })),
          setores: reg.setores.map((s) => ({
            id: s.id,
            nome: s.nome,
            poly: parsePolygonLatLng(s.poligonoGeojson),
          })),
        });
      } catch {
        if (!active) return;
        setGeometriaMapa(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [token, user, semFazenda]);

  const filteredOcorrencias = useMemo(() => {
    const now = Date.now();
    const thresholdMs =
      periodo === '7d' ? now - 7 * 24 * 60 * 60 * 1000 : periodo === '30d' ? now - 30 * 24 * 60 * 60 * 1000 : null;
    const startMs = rangeStart ? Date.parse(`${rangeStart}T00:00:00`) : null;
    const endMs = rangeEnd ? Date.parse(`${rangeEnd}T23:59:59`) : null;

    return ocorrencias.filter((o) => {
      const t = Date.parse(o.horario);
      if (Number.isNaN(t)) return false;
      if (thresholdMs !== null && t < thresholdMs) return false;
      if (startMs !== null && t < startMs) return false;
      if (endMs !== null && t > endMs) return false;
      if (tipoFilter !== 'TODOS' && o.categoria.trim().toUpperCase() !== tipoFilter) return false;
      if (areaFilter !== 'TODOS' && o.setor.trim() !== areaFilter) return false;
      if (prioridadeFilter !== 'TODAS' && prioridadeOcorrencia(o.prioridade) !== prioridadeFilter) return false;
      if (statusFilter !== 'TODOS' && statusOcorrencia(o.status) !== statusFilter) return false;
      return true;
    });
  }, [ocorrencias, periodo, rangeStart, rangeEnd, tipoFilter, areaFilter, prioridadeFilter, statusFilter]);

  const tipoOptions = useMemo(
    () => Array.from(new Set(ocorrencias.map((o) => o.categoria.trim().toUpperCase()).filter(Boolean))).sort(),
    [ocorrencias],
  );
  const areaOptions = useMemo(
    () => Array.from(new Set(ocorrencias.map((o) => o.setor.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [ocorrencias],
  );

  const comparativoOcorrencias = useMemo(() => {
    const now = Date.now();
    const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 30;
    const janelaAtualIni = now - dias * 24 * 60 * 60 * 1000;
    const janelaAnteriorIni = now - 2 * dias * 24 * 60 * 60 * 1000;
    const atual = ocorrencias.filter((o) => {
      const t = Date.parse(o.horario);
      return !Number.isNaN(t) && t >= janelaAtualIni && t <= now;
    }).length;
    const anterior = ocorrencias.filter((o) => {
      const t = Date.parse(o.horario);
      return !Number.isNaN(t) && t >= janelaAnteriorIni && t < janelaAtualIni;
    }).length;
    if (anterior === 0) return 0;
    return ((atual - anterior) / anterior) * 100;
  }, [ocorrencias, periodo]);

  const statusStats = useMemo(() => {
    const abertas = filteredOcorrencias.filter((o) => String(o.status ?? '').toUpperCase() !== 'RESOLVIDA').length;
    const resolvidas = filteredOcorrencias.length - abertas;
    return {
      abertas,
      resolvidas,
      total: filteredOcorrencias.length,
    };
  }, [filteredOcorrencias]);

  const prioridadesStats = useMemo(() => {
    const criticas = filteredOcorrencias.filter((o) => prioridadeOcorrencia(o.prioridade) === 'URGENTE').length;
    return { criticas };
  }, [filteredOcorrencias]);

  const mediaResolucaoDias = useMemo(() => {
    const resolvidas = filteredOcorrencias.filter((o) => String(o.status ?? '').toUpperCase() === 'RESOLVIDA');
    if (resolvidas.length === 0) return null;
    const agora = Date.now();
    const soma = resolvidas.reduce((acc, o) => {
      const t = Date.parse(o.horario);
      if (Number.isNaN(t)) return acc;
      return acc + Math.max(0, agora - t);
    }, 0);
    const dias = soma / resolvidas.length / (24 * 60 * 60 * 1000);
    return dias;
  }, [filteredOcorrencias]);

  const areaBars = useMemo(() => {
    const counts = new Map<string, number>();
    filteredOcorrencias.forEach((o) => {
      const key = o.setor?.trim() || 'Sem setor';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const items = Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const max = Math.max(1, ...items.map((i) => i.count));
    return items.map((i) => ({
      ...i,
      hPx: Math.max(8, Math.round((i.count / max) * BAR_MAX_HEIGHT)),
    }));
  }, [filteredOcorrencias]);

  const tableRows = useMemo(() => {
    return filteredOcorrencias
      .map((o) => {
        const prioridade = prioridadeOcorrencia(o.prioridade);
        return {
          id: `OC-${String(o.id).padStart(4, '0')}`,
          idNum: o.id,
          data: formatDate(o.horario),
          tipo: labelCategoria(o.categoria),
          area: o.setor || 'Sem setor',
          prioridade: prioridadeToBadge(prioridade),
          status: String(o.status ?? '').toUpperCase() === 'RESOLVIDA' ? 'Resolvida' : 'Em aberto',
        };
      })
      .sort((a, b) => b.idNum - a.idNum);
  }, [filteredOcorrencias]);

  useEffect(() => {
    setAnimTick((v) => v + 1);
  }, [periodo, rangeStart, rangeEnd, tipoFilter, areaFilter, prioridadeFilter, statusFilter, filteredOcorrencias.length]);

  const donutStyle = useMemo(() => {
    const total = Math.max(1, statusStats.total);
    const resolvidoP = (statusStats.resolvidas / total) * 100;
    const abertoP = Math.max(0, 100 - resolvidoP);
    return {
      background: `conic-gradient(var(--primary) 0% ${resolvidoP}%, #c24141 ${resolvidoP}% ${resolvidoP + abertoP}%)`,
    };
  }, [statusStats]);

  useEffect(() => {
    let cancelled = false;
    setMapaPreviewLoading(true);
    buildRelatorioMapPngAsync(layersParaMapaRelatorio(geometriaMapa, filteredOcorrencias))
      .then((url) => {
        if (!cancelled) setMapaPreviewUrl(url);
      })
      .finally(() => {
        if (!cancelled) setMapaPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [geometriaMapa, filteredOcorrencias]);

  function exportCsv() {
    const header = ['ID', 'Data', 'Tipo', 'Area', 'Prioridade', 'Status'];
    const lines = tableRows.map((r) => [r.id, r.data, r.tipo, r.area, prioridadeLabel(r.prioridade), r.status]);
    const csv = [header, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-ocorrencias-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    await runWithLoading(async () => {
    const { downloadRelatorioOcorrenciasPdf } = await import('../utils/relatorioPdf');
    const periodoLabel = periodo === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias';
    const intervaloDatas = formatIntervaloDatas(rangeStart, rangeEnd);
    const tipoLabel = tipoFilter === 'TODOS' ? 'Todos' : labelCategoria(tipoFilter);
    const areaLabel = areaFilter === 'TODOS' ? 'Todas' : areaFilter;
    const prioridadeLabelFiltro = labelPrioridadeFiltro(prioridadeFilter);
    const statusLabelFiltro = labelStatusFiltro(statusFilter);
    const mediaResolucaoValor = mediaResolucaoDias === null ? '—' : `${mediaResolucaoDias.toFixed(1)} dias`;
    const kpiCriticasSubtexto =
      statusStats.total === 0
        ? 'Sem dados no período'
        : `${((prioridadesStats.criticas / statusStats.total) * 100).toFixed(1)}% do total`;

    const mapaPngDataUrl = await buildRelatorioMapPngAsync(layersParaMapaRelatorio(geometriaMapa, filteredOcorrencias));

    downloadRelatorioOcorrenciasPdf({
      geradoEm: new Date().toLocaleString('pt-BR'),
      periodoLabel,
      intervaloDatas,
      tipoLabel,
      areaLabel,
      prioridadeLabel: prioridadeLabelFiltro,
      statusLabel: statusLabelFiltro,
      totalOcorrencias: statusStats.total,
      comparativoPercent: comparativoOcorrencias,
      mediaResolucaoValor,
      criticasCount: prioridadesStats.criticas,
      kpiCriticasSubtexto,
      resolvidas: statusStats.resolvidas,
      abertas: statusStats.abertas,
      pctResolvidas: percent(statusStats.resolvidas, statusStats.total).replace(/[()]/g, ''),
      pctAbertas: percent(statusStats.abertas, statusStats.total).replace(/[()]/g, ''),
      areaBars: areaBars.map(({ label, count }) => ({ label, count })),
      linhasTabela: tableRows.map((row) => ({
        id: row.id,
        data: row.data,
        tipo: row.tipo,
        area: row.area,
        prioridade: prioridadeLabel(row.prioridade),
        status: row.status,
      })),
      mapaPngDataUrl,
    });
    }, 'Gerando PDF…');
  }

  if (semFazenda) {
    return (
      <AppShell>
        <div className="relatorio-page">
          <header className="relatorio-page__head">
            <div className="relatorio-page__intro">
              <h1 className="relatorio-page__title">Relatórios operacionais</h1>
              <p className="relatorio-page__subtitle muted">Visão detalhada de desempenho e ocorrências em campo.</p>
            </div>
          </header>
          <SemFazendaAviso papel={user?.papel} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="relatorio-page" data-periodo={periodo}>
        <header className="relatorio-page__head">
          <div className="relatorio-page__intro">
            <h1 className="relatorio-page__title">Relatórios operacionais</h1>
            <p className="relatorio-page__subtitle muted">Visão detalhada de desempenho e ocorrências em campo.</p>
          </div>
          <div className="relatorio-page__filters relatorio-page__filters--period" role="group" aria-label="Período do relatório">
            {(
              [
                { id: '7d' as const, label: 'Últimos 7 dias' },
                { id: '30d' as const, label: 'Últimos 30 dias' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`relatorio-page__filter${periodo === p.id ? ' relatorio-page__filter--active' : ''}`}
                onClick={() => setPeriodo(p.id)}
                aria-pressed={periodo === p.id}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>
        <div className="relatorio-page__filter-panel">
          <label className="relatorio-page__filter-field">
            <span>Data inicial</span>
            <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </label>
          <label className="relatorio-page__filter-field">
            <span>Data final</span>
            <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </label>
          <label className="relatorio-page__filter-field">
            <span>Tipo</span>
            <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
              <option value="TODOS">Todos</option>
              {tipoOptions.map((t) => (
                <option key={t} value={t}>
                  {labelCategoria(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="relatorio-page__filter-field">
            <span>Área</span>
            <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
              <option value="TODOS">Todas</option>
              {areaOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="relatorio-page__filter-field">
            <span>Prioridade</span>
            <select
              value={prioridadeFilter}
              onChange={(e) => setPrioridadeFilter(e.target.value as 'TODAS' | 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE')}
            >
              <option value="TODAS">Todas</option>
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Crítica</option>
            </select>
          </label>
          <label className="relatorio-page__filter-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'TODOS' | 'ABERTA' | 'RESOLVIDA')}>
              <option value="TODOS">Todos</option>
              <option value="ABERTA">Em aberto</option>
              <option value="RESOLVIDA">Resolvida</option>
            </select>
          </label>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={() => {
              setTipoFilter('TODOS');
              setAreaFilter('TODOS');
              setPrioridadeFilter('TODAS');
              setStatusFilter('TODOS');
              setRangeStart('');
              setRangeEnd('');
              setPeriodo('7d');
            }}
          >
            Limpar filtros
          </button>
        </div>
        {loading ? <p className="muted">Carregando dados do relatório...</p> : null}
        {error ? <p role="alert">Erro ao carregar relatório: {error}</p> : null}

        <section className="relatorio-page__kpis" aria-label="Indicadores">
          <article className="rel-kpi">
            <span className="rel-kpi__icon" aria-hidden>
              📄
            </span>
            <div>
              <p className="rel-kpi__label muted small">Total de ocorrências</p>
              <p className="rel-kpi__value">{statusStats.total}</p>
              <p className={`rel-kpi__delta ${comparativoOcorrencias >= 0 ? 'rel-kpi__delta--up' : 'rel-kpi__delta--down'}`}>
                {comparativoOcorrencias >= 0 ? '↗' : '↘'} {Math.abs(comparativoOcorrencias).toFixed(1)}% no período comparável
              </p>
            </div>
          </article>
          <article className="rel-kpi">
            <span className="rel-kpi__icon" aria-hidden>
              🕐
            </span>
            <div>
              <p className="rel-kpi__label muted small">Média de resolução</p>
              <p className="rel-kpi__value">{mediaResolucaoDias === null ? '—' : `${mediaResolucaoDias.toFixed(1)} dias`}</p>
              <p className="rel-kpi__delta rel-kpi__delta--down">Baseado nas ocorrências resolvidas do período</p>
            </div>
          </article>
          <article className="rel-kpi">
            <span className="rel-kpi__icon rel-kpi__icon--warn" aria-hidden>
              ⚠
            </span>
            <div>
              <p className="rel-kpi__label muted small">Ocorrências críticas</p>
              <p className="rel-kpi__value">{prioridadesStats.criticas}</p>
              <p className="rel-kpi__delta rel-kpi__delta--down-good">
                {statusStats.total === 0 ? 'Sem dados no período' : `${((prioridadesStats.criticas / statusStats.total) * 100).toFixed(1)}% do total`}
              </p>
            </div>
          </article>
        </section>

        <section className="relatorio-page__charts" aria-label="Gráficos">
          <div className="rel-chart">
            <h2 className="rel-chart__title">Distribuição por status</h2>
            <div className="rel-chart__body rel-chart__body--donut">
              <div className="rel-donut-wrap">
                <div
                  key={`donut-${animTick}`}
                  className="rel-donut"
                  style={donutStyle}
                  role="img"
                  aria-label={`Gráfico: ${statusStats.resolvidas} resolvidas e ${statusStats.abertas} abertas`}
                />
                <div className="rel-donut__center">
                  <strong>{statusStats.total}</strong>
                  <span>Total</span>
                </div>
              </div>
              <ul className="rel-donut__legend muted small">
                <li>
                  <span className="rel-donut__sw rel-donut__sw--ok" /> Resolvido ({statusStats.resolvidas}){' '}
                  {percent(statusStats.resolvidas, statusStats.total)}
                </li>
                <li>
                  <span className="rel-donut__sw rel-donut__sw--crit" /> Aberto ({statusStats.abertas}){' '}
                  {percent(statusStats.abertas, statusStats.total)}
                </li>
              </ul>
            </div>
          </div>
          <div className="rel-chart">
            <h2 className="rel-chart__title">Ocorrências por área</h2>
            <div className="rel-chart__body rel-chart__body--bars">
              <div className="rel-bars" role="img" aria-label="Barras por setor">
                {areaBars.map((b, index) => (
                  <div key={`${b.label}-${animTick}`} className="rel-bars__col">
                    <div className="rel-bars__bar-wrap">
                      <span className="rel-bars__value" style={{ bottom: `${b.hPx + 6}px` }}>
                        {b.count}
                      </span>
                      <div
                        className="rel-bars__bar rel-bars__bar--animated"
                        style={{ height: `${b.hPx}px`, animationDelay: `${index * 55}ms` }}
                        title={`${b.count} ocorrência(s)`}
                      />
                    </div>
                    <span className="rel-bars__label muted small">{b.label}</span>
                  </div>
                ))}
                {areaBars.length === 0 ? <p className="rel-chart__empty muted">Sem dados para exibir.</p> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="relatorio-page__map-section" aria-labelledby="rel-map-heading">
          <div className="rel-chart relatorio-page__map-card">
            <h2 id="rel-map-heading" className="rel-chart__title">
              Mapa do recorte
            </h2>
            <p className="relatorio-page__map-caption muted small">
              Fundo cartográfico OpenStreetMap (ruas) quando a rede permite; perímetro da fazenda, setores com polígono e ocorrências filtradas por cima. O mesmo mapa entra no PDF (se os tiles carregarem; senão, usa-se o diagrama neutro).
            </p>
            {mapaPreviewLoading && !mapaPreviewUrl ? (
              <p className="relatorio-page__map-loading muted small">Carregando mapa de fundo…</p>
            ) : null}
            {mapaPreviewUrl ? (
              <div className={`relatorio-page__map-frame${mapaPreviewLoading ? ' relatorio-page__map-frame--loading' : ''}`}>
                <img
                  src={mapaPreviewUrl}
                  alt="Mapa da fazenda com fundo de ruas, perímetro, setores e marcadores das ocorrências do recorte atual."
                  className="relatorio-page__map-img"
                  width={RELATORIO_MAPA_EXPORT_SIZE}
                  height={RELATORIO_MAPA_EXPORT_SIZE}
                />
              </div>
            ) : !mapaPreviewLoading ? (
              <p className="relatorio-page__map-empty muted small">
                {token
                  ? 'Não há dados suficientes para o mapa. Cadastre o perímetro da fazenda e polígonos dos setores em Minha fazenda, ou ajuste os filtros para exibir ocorrências com localização no recorte.'
                  : 'Entre na conta para carregar o mapa da fazenda e os pontos das ocorrências.'}
              </p>
            ) : null}
          </div>
        </section>

        <section className="relatorio-page__raw" aria-labelledby="rel-raw-heading">
          <div className="relatorio-page__raw-head">
            <h2 id="rel-raw-heading">Resumo de dados brutos</h2>
            <div className="relatorio-page__exports">
              <button type="button" className="btn ghost btn-sm" onClick={exportCsv}>
                Exportar CSV
              </button>
              <button type="button" className="btn primary btn-sm" onClick={exportPdf}>
                Exportar PDF
              </button>
            </div>
          </div>
          <div className="rel-table-wrap">
            <table className="rel-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Área</th>
                  <th>Prioridade</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.id}</strong>
                    </td>
                    <td>{row.data}</td>
                    <td>{row.tipo}</td>
                    <td>{row.area}</td>
                    <td>
                      <span className={`rel-badge rel-badge--${row.prioridade}`}>{prioridadeLabel(row.prioridade)}</span>
                    </td>
                    <td>{row.status}</td>
                    <td>
                      <Link to={`/ocorrencias/${row.idNum}`} className="rel-table__more" aria-label={`Abrir ${row.id}`}>
                        ↗
                      </Link>
                    </td>
                  </tr>
                ))}
                {!loading && tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      Nenhuma ocorrência encontrada para o período selecionado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="relatorio-page__footer muted small">
          <span>© 2026 AGROLINK — Gestão rural inteligente</span>
          <span className="relatorio-page__footer-links">
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

function prioridadeLabel(p: 'alta' | 'media' | 'critica' | 'baixa'): string {
  const m = { alta: 'Alta', media: 'Média', critica: 'Crítica', baixa: 'Baixa' };
  return m[p];
}

function prioridadeToBadge(prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'): 'alta' | 'media' | 'critica' | 'baixa' {
  if (prioridade === 'URGENTE') return 'critica';
  if (prioridade === 'ALTA') return 'alta';
  if (prioridade === 'MEDIA') return 'media';
  return 'baixa';
}

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString('pt-BR');
}

function percent(parte: number, total: number): string {
  if (total <= 0) return '(0,0%)';
  return `(${((parte / total) * 100).toFixed(1)}%)`;
}

function formatIntervaloDatas(rangeStart: string, rangeEnd: string): string {
  const fmt = (d: string) => {
    if (!d) return '';
    const t = Date.parse(`${d}T12:00:00`);
    return Number.isNaN(t) ? d : new Date(t).toLocaleDateString('pt-BR');
  };
  if (rangeStart && rangeEnd) return `${fmt(rangeStart)} a ${fmt(rangeEnd)}`;
  if (rangeStart) return `A partir de ${fmt(rangeStart)}`;
  if (rangeEnd) return `Até ${fmt(rangeEnd)}`;
  return 'Somente período base (sem intervalo explícito)';
}

function labelPrioridadeFiltro(p: 'TODAS' | 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'): string {
  const m: Record<typeof p, string> = {
    TODAS: 'Todas',
    BAIXA: 'Baixa',
    MEDIA: 'Média',
    ALTA: 'Alta',
    URGENTE: 'Crítica',
  };
  return m[p];
}

function labelStatusFiltro(s: 'TODOS' | 'ABERTA' | 'RESOLVIDA'): string {
  const m: Record<typeof s, string> = {
    TODOS: 'Todos',
    ABERTA: 'Em aberto',
    RESOLVIDA: 'Resolvida',
  };
  return m[s];
}
