import { Link, Navigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../auth/AuthContext';
import { fetchMembrosEquipe, type MembroDto } from '../api/equipeApi';
import {
  CATEGORIAS_REGISTRO,
  PRIORIDADES_REGISTRO,
  assumirResponsavelOcorrencia,
  comentarOcorrencia,
  comentarOcorrenciaComAnexos,
  definirResponsavelOcorrencia,
  editarOcorrencia,
  fetchOcorrencia,
  formatOcorrenciaHorario,
  imagemCategoria,
  labelCategoria,
  parseLinhaComentarioOcorrencia,
  prioridadeOcorrencia,
  prioridadeOcorrenciaLabel,
  prioridadeOcorrenciaTone,
  resolverOcorrencia,
  statusOcorrencia,
  statusOcorrenciaLabel,
  statusOcorrenciaTone,
  uploadOcorrenciaImagens,
  type OcorrenciaDto,
} from '../api/ocorrenciasApi';

const MAX_EVIDENCIAS_OCORRENCIA = 6;
const MAX_ANEXOS_COMENTARIO = 3;

/**
 * Detalhe de uma ocorrência carregada da API (`GET /api/ocorrencias/:id`).
 */
export function OcorrenciaDetalhePage() {
  const { user, token } = useAuth();
  const { id: idParam } = useParams<{ id: string }>();
  const idNum = idParam ? Number.parseInt(idParam, 10) : NaN;
  const idValid = Number.isFinite(idNum) && idNum > 0;

  const [occ, setOcc] = useState<OcorrenciaDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [funcionarios, setFuncionarios] = useState<MembroDto[]>([]);
  const [assignSelectId, setAssignSelectId] = useState<string>('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const evidenciaInputRef = useRef<HTMLInputElement>(null);
  const comentarioAnexoRef = useRef<HTMLInputElement>(null);

  const [editTitulo, setEditTitulo] = useState('');
  const [editSetor, setEditSetor] = useState('');
  const [editCategoria, setEditCategoria] = useState('PRAGA');
  const [editPrioridade, setEditPrioridade] = useState<'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'>('MEDIA');
  const [editDescricao, setEditDescricao] = useState('');

  const prioridade = occ ? prioridadeOcorrencia(occ.prioridade) : null;
  const status = occ ? statusOcorrencia(occ.status) : 'ABERTA';
  const statusWireframeLabel = status === 'RESOLVIDA' ? 'Resolvida' : 'Em andamento';

  useEffect(() => {
    if (!idValid) {
      setLoading(false);
      return;
    }
    if (!token) {
      setError('Faça login para ver esta ocorrência.');
      setOcc(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);
    fetchOcorrencia(idNum, token)
      .then((data) => {
        if (!cancelled) setOcc(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Não foi possível carregar.');
          setOcc(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idValid, idNum, token]);

  useEffect(() => {
    if (!showAssignModal || !token) return;
    let cancelled = false;
    fetchMembrosEquipe(token, 'FUNCIONARIO_CAMPO')
      .then((list) => {
        if (!cancelled) setFuncionarios(list.filter((m) => m.ativo));
      })
      .catch(() => {
        if (!cancelled) setFuncionarios([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showAssignModal, token]);

  useEffect(() => {
    if (!showAssignModal || funcionarios.length === 0) return;
    setAssignSelectId((prev) => {
      if (prev && funcionarios.some((m) => String(m.id) === prev)) return prev;
      return String(funcionarios[0]!.id);
    });
  }, [showAssignModal, funcionarios]);

  if (!idParam || !idValid) {
    return <Navigate to="/ocorrencias" replace />;
  }

  if (loading) {
    return (
      <AppShell>
        <div className="occ-detail-page">
          <Link to="/ocorrencias" className="occ-detail-page__back" aria-label="Voltar para ocorrências">
            Voltar
          </Link>
          <p className="muted">Carregando…</p>
        </div>
      </AppShell>
    );
  }

  if (error || !occ) {
    return (
      <AppShell>
        <div className="occ-detail-page">
          <Link to="/ocorrencias" className="occ-detail-page__back" aria-label="Voltar para ocorrências">
            Voltar
          </Link>
          <p className="error-text" role="alert">
            {error ?? 'Ocorrência não encontrada.'}
          </p>
        </div>
      </AppShell>
    );
  }

  const imagensReais = occ.imagens ?? [];
  const evidencias =
    imagensReais.length > 0 ? imagensReais : [imagemCategoria(occ.categoria)];
  const vagasEvidencia = Math.max(0, MAX_EVIDENCIAS_OCORRENCIA - imagensReais.length);

  const podeAssumir =
    user && (user.papel === 'FUNCIONARIO_CAMPO' || user.papel === 'GERENTE') && status === 'ABERTA';
  const responsavelOutro =
    occ.responsavelId != null && user != null && occ.responsavelId !== user.id;
  const podeGerenteAtribuir =
    (user?.papel === 'GERENTE' || user?.papel === 'PRODUTOR') && status === 'ABERTA';

  async function handleResolver() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await resolverOcorrencia(occ.id, token);
      setOcc(updated);
      setShowResolveModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível resolver.');
    } finally {
      setBusy(false);
    }
  }

  async function handleComentar() {
    const texto = commentText.trim();
    if (!texto && commentFiles.length === 0) return;
    if (commentFiles.length > 0 && !token) {
      setError('Faça login para anexar imagens ao comentário.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let updated: OcorrenciaDto;
      if (commentFiles.length > 0 && token) {
        updated = await comentarOcorrenciaComAnexos(occ.id, texto, commentFiles.slice(0, MAX_ANEXOS_COMENTARIO), token);
      } else {
        updated = await comentarOcorrencia(occ.id, texto, token);
      }
      setOcc(updated);
      setCommentText('');
      setCommentFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível comentar.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEditar() {
    const titulo = editTitulo.trim();
    const setor = editSetor.trim();
    if (!titulo || !setor) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await editarOcorrencia(
        occ.id,
        {
          titulo,
          setor,
          categoria: editCategoria,
          prioridade: editPrioridade,
          descricao: editDescricao.trim(),
          status,
          coordsX: occ.coordsX,
          coordsY: occ.coordsY,
        },
        token,
      );
      setOcc(updated);
      setShowEditModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível editar.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAssumir() {
    if (!token) {
      setError('Faça login para assumir a ocorrência.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await assumirResponsavelOcorrencia(occ.id, token);
      setOcc(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível assumir.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmarAtribuicaoGerente(remover: boolean) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const uid = remover ? null : Number.parseInt(assignSelectId, 10);
      if (!remover && (!Number.isFinite(uid) || uid <= 0)) {
        setError('Selecione um funcionário.');
        setBusy(false);
        return;
      }
      const updated = await definirResponsavelOcorrencia(occ.id, remover ? null : uid, token);
      setOcc(updated);
      setShowAssignModal(false);
      setAssignSelectId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível atribuir.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEvidenciasChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length || vagasEvidencia <= 0) return;
    const slice = files.slice(0, vagasEvidencia);
    setBusy(true);
    setError(null);
    try {
      const updated = await uploadOcorrenciaImagens(occ.id, slice, token);
      setOcc(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar imagens.');
    } finally {
      setBusy(false);
    }
  }

  function handleComentarioAnexosChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    ev.target.value = '';
    if (!files.length) return;
    setCommentFiles((prev) => {
      const vagas = Math.max(0, MAX_ANEXOS_COMENTARIO - prev.length);
      return [...prev, ...files.slice(0, vagas)];
    });
  }

  const comentarios = occ.comentarios
    ? occ.comentarios
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
  const comentariosTimeline = comentarios.map((linha, idx) => {
    const p = parseLinhaComentarioOcorrencia(linha);
    return {
      id: `${idx}-${linha.slice(0, 40)}`,
      quando: p.quando ? formatOcorrenciaHorario(p.quando) : '',
      autor: p.autor,
      texto: p.texto,
      fotoUrl: p.fotoUrl,
      anexos: p.anexos,
      tipo: 'comentario' as const,
    };
  });
  const observacaoInicial = occ.descricao?.trim()
    ? {
        id: `obs-inicial-${occ.id}`,
        quando: formatOcorrenciaHorario(occ.horario),
        autor: 'Descrição no registro',
        texto: occ.descricao.trim(),
        fotoUrl: null as string | null,
        anexos: [] as string[],
        tipo: 'observacao' as const,
      }
    : null;
  const atividadesTimeline = observacaoInicial
    ? [observacaoInicial, ...comentariosTimeline]
    : comentariosTimeline;

  return (
    <AppShell>
      <div className="occ-detail-page">
        <input
          ref={evidenciaInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="sr-only"
          onChange={handleEvidenciasChange}
        />
        <input
          ref={comentarioAnexoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="sr-only"
          onChange={handleComentarioAnexosChange}
        />

        <div className="occ-detail-hero">
          <Link
            to="/ocorrencias"
            className="occ-detail-page__back occ-detail-hero__back"
            aria-label="Voltar para ocorrências"
          >
            Voltar
          </Link>
          <div className="occ-detail-hero__grid">
            <div className="occ-detail-hero__text">
              <p className="occ-detail-page__meta muted small">
                OCR-{String(occ.id).padStart(7, '0')}
                <span className="occ-detail-page__meta-sep">·</span>
                {formatOcorrenciaHorario(occ.horario)}
                <span className="occ-detail-page__meta-sep">·</span>
                {labelCategoria(occ.categoria)}
              </p>
              <h1 className="occ-detail-page__title occ-detail-hero__title">{occ.titulo}</h1>
              <div className="occ-detail-hero__chips">
                <span className={`occ-detail-page__status-pill occ-detail-page__status-pill--${statusOcorrenciaTone(status)}`}>
                  {statusWireframeLabel}
                </span>
                {prioridade ? (
                  <span
                    className={`occ-card__prio occ-card__prio--${prioridadeOcorrenciaTone(prioridade)} occ-detail-page__prio-pill`}
                  >
                    {prioridadeOcorrenciaLabel(prioridade)}
                  </span>
                ) : null}
                <span className="occ-detail-hero__chip-muted">{statusOcorrenciaLabel(status)}</span>
              </div>
              <div className="occ-detail-hero__assign">
                <span className="muted small">Responsável</span>
                <p className="occ-detail-hero__assign-name">
                  {occ.responsavelNome?.trim()
                    ? occ.responsavelNome
                    : occ.responsavelId
                      ? `Usuário #${occ.responsavelId}`
                      : 'Ninguém atribuído ainda'}
                </p>
                <div className="occ-detail-hero__assign-actions">
                  {podeAssumir && !responsavelOutro ? (
                    <button
                      type="button"
                      className="btn ghost btn-sm"
                      onClick={handleAssumir}
                      disabled={busy || occ.responsavelId === user?.id}
                    >
                      {occ.responsavelId === user?.id ? 'Você é o responsável' : 'Assumir ocorrência'}
                    </button>
                  ) : null}
                  {podeGerenteAtribuir ? (
                    <button
                      type="button"
                      className="btn ghost btn-sm"
                      onClick={() => setShowAssignModal(true)}
                      disabled={busy}
                    >
                      Atribuir funcionário…
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="occ-detail-hero__toolbar">
              <button
                type="button"
                className="btn primary btn-sm"
                onClick={() => setShowResolveModal(true)}
                disabled={busy || status === 'RESOLVIDA'}
              >
                Resolver
              </button>
              <button
                type="button"
                className="btn ghost btn-sm"
                onClick={() => {
                  setEditTitulo(occ.titulo);
                  setEditSetor(occ.setor);
                  setEditCategoria(occ.categoria);
                  setEditPrioridade(prioridade ?? 'MEDIA');
                  setEditDescricao(occ.descricao ?? '');
                  setShowEditModal(true);
                }}
                disabled={busy}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn ghost btn-sm"
                onClick={() => evidenciaInputRef.current?.click()}
                disabled={busy || vagasEvidencia <= 0 || status === 'RESOLVIDA'}
                title={vagasEvidencia <= 0 ? 'Limite de 6 imagens' : 'Anexar fotos da ocorrência'}
              >
                Anexar fotos
                {vagasEvidencia < MAX_EVIDENCIAS_OCORRENCIA ? ` (${vagasEvidencia} restantes)` : ''}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <p className="error-text occ-detail-page__alert" role="alert">
            {error}
          </p>
        ) : null}

        <section className="occ-detail__section" aria-label="Detalhes da ocorrência">
          <div className="occ-detail-page__layout">
            <div className="occ-detail-main">
              <div className="occ-detail-panel">
                <div className="occ-detail-panel__head">
                  <h2 className="occ-detail-panel__title">Evidências</h2>
                  <span className="muted small">
                    {imagensReais.length} de {MAX_EVIDENCIAS_OCORRENCIA} fotos
                  </span>
                </div>
                <div className="occ-detail__ev-grid occ-detail__ev-grid--detail">
                  {evidencias.map((src, idx) => (
                    <button
                      key={`${src}-${idx}`}
                      type="button"
                      className={`occ-card__media occ-card__media--${idx % 4 === 0 ? 'a' : idx % 4 === 1 ? 'b' : idx % 4 === 2 ? 'c' : 'd'} occ-detail__ev-tile occ-detail__ev-tile--btn`}
                      style={{
                        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.22)), url("${src}")`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                      onClick={() => setLightboxSrc(src)}
                      aria-label={`Ampliar imagem ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              <div className="occ-detail-panel occ-detail-panel--ficha">
                <h2 className="occ-detail-panel__title">Ficha da ocorrência</h2>
                <div className="occ-detail-ficha-grid">
                  <dl className="occ-detail__dl occ-detail-ficha__block">
                    <div>
                      <dt>Setor / área</dt>
                      <dd>{occ.setor}</dd>
                    </div>
                    <div>
                      <dt>Latitude</dt>
                      <dd>{occ.coordsY.toFixed(6)}°</dd>
                    </div>
                    <div>
                      <dt>Longitude</dt>
                      <dd>{occ.coordsX.toFixed(6)}°</dd>
                    </div>
                    <div>
                      <dt>Aberta em</dt>
                      <dd>{formatOcorrenciaHorario(occ.horario)}</dd>
                    </div>
                  </dl>
                  <dl className="occ-detail__dl occ-detail-ficha__block">
                    <div>
                      <dt>Categoria</dt>
                      <dd>{labelCategoria(occ.categoria)}</dd>
                    </div>
                    <div>
                      <dt>Prioridade</dt>
                      <dd>{prioridade ? prioridadeOcorrenciaLabel(prioridade) : 'Média'}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{statusOcorrenciaLabel(status)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            <aside className="occ-detail-page__aside" aria-label="Atividades e comentários">
              <section className="occ-detail__card occ-detail__card--timeline">
                <h3 className="occ-detail__h3">Atividades</h3>
                {atividadesTimeline.length === 0 ? (
                  <p className="muted">Nenhuma atividade ainda.</p>
                ) : (
                  <ul className="occ-detail__timeline">
                    {atividadesTimeline.map((c) => (
                      <li key={c.id} className="occ-detail__timeline-item">
                        {c.tipo === 'observacao' ? (
                          <span className="occ-detail__timeline-av occ-detail__timeline-av--obs" aria-hidden />
                        ) : (
                          <UserAvatar nome={c.autor} fotoUrl={c.fotoUrl} className="occ-detail__timeline-user-av" />
                        )}
                        <div className="occ-detail__timeline-body">
                          <p className="occ-detail__timeline-who">
                            <strong>{c.autor}</strong>
                            {c.quando ? ` · ${c.quando}` : ''}
                          </p>
                          <p className="occ-detail__timeline-quote">{c.texto}</p>
                          {c.anexos.length > 0 ? (
                            <div className="occ-detail__comment-thumbs">
                              {c.anexos.map((u) => (
                                <button key={u} type="button" className="occ-detail__comment-thumb" onClick={() => setLightboxSrc(u)}>
                                  <img src={u} alt="" />
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="occ-detail__compose">
                  <label className="occ-detail__compose-label" htmlFor="occ-detail-comment">
                    Novo comentário
                  </label>
                  <textarea
                    id="occ-detail-comment"
                    className="occ-detail__textarea"
                    rows={4}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Descreva o andamento…"
                    maxLength={500}
                    disabled={busy || status === 'RESOLVIDA'}
                  />
                  {commentFiles.length > 0 ? (
                    <ul className="occ-detail__pending-files">
                      {commentFiles.map((f) => (
                        <li key={f.name + f.lastModified}>
                          <span>{f.name}</span>
                          <button
                            type="button"
                            className="occ-detail__pending-remove"
                            onClick={() => setCommentFiles((prev) => prev.filter((x) => x !== f))}
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="occ-detail__compose-actions">
                    <button
                      type="button"
                      className="btn ghost btn-sm"
                      onClick={() => comentarioAnexoRef.current?.click()}
                      disabled={
                        busy || status === 'RESOLVIDA' || commentFiles.length >= MAX_ANEXOS_COMENTARIO || !token
                      }
                      title={!token ? 'Login necessário para anexar' : 'Até 3 imagens'}
                    >
                      Anexar ao comentário
                    </button>
                    <button
                      type="button"
                      className="btn primary btn-sm"
                      onClick={handleComentar}
                      disabled={busy || status === 'RESOLVIDA' || (!commentText.trim() && commentFiles.length === 0)}
                    >
                      Publicar
                    </button>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>

      {lightboxSrc ? (
        <div className="occ-lightbox" role="dialog" aria-modal="true" aria-label="Visualizar imagem">
          <button type="button" className="occ-lightbox__backdrop" onClick={() => setLightboxSrc(null)} aria-label="Fechar" />
          <div className="occ-lightbox__frame">
            <button type="button" className="occ-lightbox__close" onClick={() => setLightboxSrc(null)}>
              ×
            </button>
            <img src={lightboxSrc} alt="" className="occ-lightbox__img" />
          </div>
        </div>
      ) : null}

      {showEditModal ? (
        <div className="equipe-modal" role="dialog" aria-modal="true" aria-label="Editar ocorrência">
          <button className="equipe-modal__backdrop" type="button" onClick={() => setShowEditModal(false)} />
          <div className="equipe-modal__panel">
            <div className="equipe-modal__head">
              <div className="equipe-modal__head-text">
                <h3 className="equipe-modal__title">Editar ocorrência</h3>
              </div>
              <button className="equipe-modal__close" type="button" onClick={() => setShowEditModal(false)}>
                ×
              </button>
            </div>
            <div className="equipe-modal__fields">
              <label className="field">
                <span>Título</span>
                <input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} />
              </label>
              <label className="field">
                <span>Setor</span>
                <input value={editSetor} onChange={(e) => setEditSetor(e.target.value)} />
              </label>
              <label className="field">
                <span>Categoria</span>
                <select value={editCategoria} onChange={(e) => setEditCategoria(e.target.value)}>
                  {CATEGORIAS_REGISTRO.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Prioridade</span>
                <select
                  value={editPrioridade}
                  onChange={(e) => setEditPrioridade(e.target.value as 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE')}
                >
                  {PRIORIDADES_REGISTRO.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Observações</span>
                <textarea rows={4} value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} />
              </label>
            </div>
            <div className="equipe-modal__footer">
              <button className="btn ghost" type="button" onClick={() => setShowEditModal(false)}>
                Cancelar
              </button>
              <button className="btn primary" type="button" onClick={handleEditar} disabled={busy}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showResolveModal ? (
        <div className="equipe-modal" role="dialog" aria-modal="true" aria-label="Confirmar resolução">
          <button className="equipe-modal__backdrop" type="button" onClick={() => setShowResolveModal(false)} />
          <div className="equipe-modal__panel">
            <div className="equipe-modal__head">
              <div className="equipe-modal__head-text">
                <h3 className="equipe-modal__title">Confirmar resolução</h3>
              </div>
              <button className="equipe-modal__close" type="button" onClick={() => setShowResolveModal(false)}>
                ×
              </button>
            </div>
            <div className="equipe-modal__fields">
              <p className="muted">Tem certeza que deseja marcar esta ocorrência como resolvida?</p>
            </div>
            <div className="equipe-modal__footer">
              <button className="btn ghost" type="button" onClick={() => setShowResolveModal(false)}>
                Cancelar
              </button>
              <button className="btn primary" type="button" onClick={handleResolver} disabled={busy}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAssignModal ? (
        <div className="equipe-modal" role="dialog" aria-modal="true" aria-label="Atribuir responsável">
          <button className="equipe-modal__backdrop" type="button" onClick={() => setShowAssignModal(false)} />
          <div className="equipe-modal__panel">
            <div className="equipe-modal__head">
              <div className="equipe-modal__head-text">
                <h3 className="equipe-modal__title">Atribuir funcionário de campo</h3>
              </div>
              <button className="equipe-modal__close" type="button" onClick={() => setShowAssignModal(false)}>
                ×
              </button>
            </div>
            <div className="equipe-modal__fields">
              <label className="field">
                <span>Funcionário</span>
                <select value={assignSelectId} onChange={(e) => setAssignSelectId(e.target.value)}>
                  {funcionarios.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </label>
              {funcionarios.length === 0 ? <p className="muted small">Nenhum funcionário cadastrado na equipe.</p> : null}
            </div>
            <div className="equipe-modal__footer equipe-modal__footer--split">
              <button className="btn ghost" type="button" onClick={() => handleConfirmarAtribuicaoGerente(true)} disabled={busy}>
                Remover responsável
              </button>
              <div className="equipe-modal__footer-right">
                <button className="btn ghost" type="button" onClick={() => setShowAssignModal(false)}>
                  Cancelar
                </button>
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => handleConfirmarAtribuicaoGerente(false)}
                  disabled={busy || funcionarios.length === 0}
                >
                  Atribuir
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
