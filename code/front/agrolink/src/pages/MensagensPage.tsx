import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../auth/AuthContext';
import type { MembroDto } from '../api/equipeApi';
import { fetchMembrosEquipe } from '../api/equipeApi';
import {
  atualizarSalaChat,
  criarSalaChat,
  enviarMensagemChat,
  enviarMensagemComArquivo,
  fetchMembrosDoCanal,
  fetchMensagensChat,
  fetchSalasChat,
  uploadImagemSalaCapa,
  papelMembroLabel,
  usuarioIdFromToken,
  type MensagemChatDto,
  type SalaChatDto,
} from '../api/chatApi';

const POLL_MS = 4500;

type FiltroLista = 'todos' | 'naoLidos' | 'grupos';

function lsReadKey(userEmail: string, salaId: number): string {
  return `agrolink_chat_last_read_${userEmail.toLowerCase()}_${salaId}`;
}

function readLastMessageId(userEmail: string | undefined, salaId: number): number {
  if (!userEmail) return 0;
  try {
    const v = localStorage.getItem(lsReadKey(userEmail, salaId));
    if (!v) return 0;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeLastMessageId(userEmail: string | undefined, salaId: number, maxId: number): void {
  if (!userEmail || maxId <= 0) return;
  try {
    localStorage.setItem(lsReadKey(userEmail, salaId), String(maxId));
  } catch {
    /* ignore */
  }
}

function formatHoraMensagem(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDataLinha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function horaListaRelativa(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return 'Agora';
  if (diff < 86_400_000) return formatHoraMensagem(iso);
  if (diff < 7 * 86_400_000) return d.toLocaleDateString('pt-BR', { weekday: 'short' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function isPdfUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf');
}

/**
 * Chat da equipe: canais, mensagens com texto/mídia, busca, filtros básicos e “não lidos” via armazenamento local.
 */
export function MensagensPage() {
  const { token, user } = useAuth();
  const [filtro, setFiltro] = useState<FiltroLista>('todos');
  const [buscaLista, setBuscaLista] = useState('');
  const [buscaThread, setBuscaThread] = useState('');
  const [buscaLateralMembros, setBuscaLateralMembros] = useState('');
  const [salas, setSalas] = useState<SalaChatDto[]>([]);
  const [salaId, setSalaId] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChatDto[]>([]);
  const [membros, setMembros] = useState<MembroDto[]>([]);
  const [membrosCanal, setMembrosCanal] = useState<MembroDto[]>([]);
  const [membrosCanalLoading, setMembrosCanalLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [modalNovaSala, setModalNovaSala] = useState(false);
  const [nomeNovaSala, setNomeNovaSala] = useState('');
  const [criandoSala, setCriandoSala] = useState(false);
  const [membrosIdsNovaSala, setMembrosIdsNovaSala] = useState<number[]>([]);
  const fileFotoRef = useRef<HTMLInputElement | null>(null);
  const fileAnexoRef = useRef<HTMLInputElement | null>(null);
  const editCanalFotoRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const attachWrapRef = useRef<HTMLDivElement | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [modalEditarCanal, setModalEditarCanal] = useState(false);
  const [editCanalNome, setEditCanalNome] = useState('');
  const [editCanalSaving, setEditCanalSaving] = useState(false);
  const [editCanalErr, setEditCanalErr] = useState<string | null>(null);
  const [editCanalFotoLabel, setEditCanalFotoLabel] = useState<string | null>(null);

  const podeCriarCanal = user?.papel === 'PRODUTOR' || user?.papel === 'GERENTE';
  const meuEmail = user?.email?.trim().toLowerCase() ?? '';

  const salaAtiva = useMemo(() => salas.find((s) => s.id === salaId) ?? salas[0] ?? null, [salas, salaId]);

  const salasFiltradas = useMemo(() => {
    const q = buscaLista.trim().toLowerCase();
    let list = salas;
    if (q) {
      list = list.filter((s) => s.nome.toLowerCase().includes(q) || (s.ultimaPreview ?? '').toLowerCase().includes(q));
    }
    if (filtro === 'naoLidos' && user?.email) {
      list = list.filter((s) => {
        const lastId = s.ultimaMensagemId ?? 0;
        const readId = readLastMessageId(user.email, s.id);
        const autorUlt = (s.ultimaAutorEmail ?? '').toLowerCase();
        return lastId > readId && autorUlt !== meuEmail;
      });
    }
    if (filtro === 'grupos') {
      /* todos os canais são grupos neste MVP */
    }
    return list;
  }, [salas, buscaLista, filtro, user?.email, meuEmail]);

  const membrosCanalFiltrados = useMemo(() => {
    const q = buscaLateralMembros.trim().toLowerCase();
    if (!q) return membrosCanal;
    return membrosCanal.filter(
      (m) =>
        m.nome.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        papelMembroLabel(m).toLowerCase().includes(q),
    );
  }, [membrosCanal, buscaLateralMembros]);

  const mensagensFiltradas = useMemo(() => {
    const q = buscaThread.trim().toLowerCase();
    if (!q) return mensagens;
    return mensagens.filter(
      (m) =>
        m.texto.toLowerCase().includes(q) ||
        m.autorNome.toLowerCase().includes(q) ||
        (m.midiaUrl ?? '').toLowerCase().includes(q),
    );
  }, [mensagens, buscaThread]);

  const midiasRecentes = useMemo(() => {
    return mensagens.filter((m) => m.midiaUrl).slice(-8).reverse();
  }, [mensagens]);

  const documentosRecentes = useMemo(() => {
    return mensagens.filter((m) => m.midiaUrl && isPdfUrl(m.midiaUrl)).slice(-6).reverse();
  }, [mensagens]);

  const marcarLidaAte = useCallback(
    (msgs: MensagemChatDto[]) => {
      if (!user?.email || msgs.length === 0 || salaId == null) return;
      const maxId = Math.max(...msgs.map((m) => m.id));
      writeLastMessageId(user.email, salaId, maxId);
    },
    [user?.email, salaId],
  );

  const recarregarTudo = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      const [s, m] = await Promise.all([
        fetchSalasChat(token, { silent }),
        salaId != null ? fetchMensagensChat(salaId, token, { silent }) : Promise.resolve([]),
      ]);
      setSalas(s);
      setMensagens(m);
      setLoadErr(null);
      if (salaId != null && Array.isArray(m) && m.length > 0) {
        marcarLidaAte(m);
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Erro ao atualizar o chat.');
    }
  }, [salaId, marcarLidaAte, token]);

  useEffect(() => {
    let cancelled = false;
    setBootLoading(true);
    setLoadErr(null);
    if (!token) {
      setLoadErr('Faça login para ver os canais de mensagens.');
      setBootLoading(false);
      return () => {
        cancelled = true;
      };
    }
    Promise.all([fetchSalasChat(token), fetchMembrosEquipe(token)])
      .then(([s, mem]) => {
        if (cancelled) return;
        setSalas(s);
        setMembros(mem);
        if (s.length > 0) {
          setSalaId((prev) => (prev != null && s.some((x) => x.id === prev) ? prev : s[0]!.id));
        } else {
          setSalaId(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : 'Não foi possível carregar o chat.');
      })
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (salaId == null) return;
    void recarregarTudo(false);
    const t = window.setInterval(() => void recarregarTudo(true), POLL_MS);
    return () => window.clearInterval(t);
  }, [salaId, recarregarTudo]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagensFiltradas.length, salaId]);

  useEffect(() => {
    if (!modalNovaSala) return;
    const me = usuarioIdFromToken(token);
    setMembrosIdsNovaSala(me != null ? [me] : []);
  }, [modalNovaSala, token]);

  useEffect(() => {
    if (salaId == null || !token) {
      setMembrosCanal([]);
      setMembrosCanalLoading(false);
      return;
    }
    let cancelled = false;
    setMembrosCanalLoading(true);
    fetchMembrosDoCanal(salaId, token)
      .then((list) => {
        if (!cancelled) setMembrosCanal(list);
      })
      .catch(() => {
        if (!cancelled) setMembrosCanal([]);
      })
      .finally(() => {
        if (!cancelled) setMembrosCanalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salaId, token]);

  useEffect(() => {
    if (!attachMenuOpen) return;
    function onPointerDown(ev: PointerEvent) {
      if (attachWrapRef.current && !attachWrapRef.current.contains(ev.target as Node)) {
        setAttachMenuOpen(false);
      }
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setAttachMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [attachMenuOpen]);

  async function handleEnviar() {
    const texto = draft.trim();
    if (!texto || salaId == null) return;
    if (!token) {
      setSendErr('Faça login para enviar mensagens.');
      return;
    }
    setSending(true);
    setSendErr(null);
    try {
      await enviarMensagemChat(salaId, texto, token);
      setDraft('');
      await recarregarTudo();
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Falha ao enviar.');
    } finally {
      setSending(false);
    }
  }

  function abrirModalEditarCanal() {
    if (salaId == null) return;
    setEditCanalNome(salaAtiva?.nome ?? '');
    setEditCanalErr(null);
    setEditCanalFotoLabel(null);
    const inp = editCanalFotoRef.current;
    if (inp) inp.value = '';
    setModalEditarCanal(true);
  }

  async function handleSalvarEdicaoCanal() {
    if (salaId == null || !token) return;
    const nome = editCanalNome.trim();
    if (!nome) {
      setEditCanalErr('Informe um nome para o canal.');
      return;
    }
    const nomeAntigo = (salaAtiva?.nome ?? '').trim();
    const file = editCanalFotoRef.current?.files?.[0];
    const nomeMudou = nome !== nomeAntigo;
    if (!nomeMudou && !file) {
      setModalEditarCanal(false);
      return;
    }
    setEditCanalSaving(true);
    setEditCanalErr(null);
    try {
      let ultima: SalaChatDto | undefined;
      if (nomeMudou) {
        ultima = await atualizarSalaChat(salaId, nome, token);
      }
      if (file) {
        ultima = await uploadImagemSalaCapa(salaId, file, token);
        if (editCanalFotoRef.current) editCanalFotoRef.current.value = '';
        setEditCanalFotoLabel(null);
      }
      if (ultima) {
        setSalas((prev) => prev.map((s) => (s.id === ultima!.id ? { ...s, ...ultima! } : s)));
      }
      setModalEditarCanal(false);
    } catch (err) {
      setEditCanalErr(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.');
    } finally {
      setEditCanalSaving(false);
    }
  }

  function handleEditCanalFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setEditCanalFotoLabel(f ? f.name : null);
  }

  async function handleArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || salaId == null || !token) {
      setSendErr('Faça login e escolha um canal.');
      return;
    }
    setSending(true);
    setSendErr(null);
    try {
      await enviarMensagemComArquivo(salaId, file, draft.trim() || null, token);
      setDraft('');
      await recarregarTudo();
    } catch (err) {
      setSendErr(err instanceof Error ? err.message : 'Falha no envio do arquivo.');
    } finally {
      setSending(false);
    }
  }

  function toggleMembroNovaSala(id: number, checked: boolean, isSelf: boolean) {
    if (isSelf && !checked) return;
    setMembrosIdsNovaSala((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  async function handleCriarSala() {
    const nome = nomeNovaSala.trim();
    if (!nome || !token) return;
    const me = usuarioIdFromToken(token);
    const ids = Array.from(new Set(membrosIdsNovaSala));
    if (me != null && !ids.includes(me)) ids.push(me);
    if (ids.length === 0) {
      setSendErr('Selecione ao menos um membro do canal.');
      return;
    }
    setCriandoSala(true);
    setSendErr(null);
    try {
      const s = await criarSalaChat(nome, ids, token);
      setNomeNovaSala('');
      setModalNovaSala(false);
      const lista = await fetchSalasChat(token);
      setSalas(lista);
      setSalaId(s.id);
      const msgs = await fetchMensagensChat(s.id, token);
      setMensagens(msgs);
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Não foi possível criar o canal.');
    } finally {
      setCriandoSala(false);
    }
  }

  function badgeNaoLidas(s: SalaChatDto): number {
    if (!user?.email) return 0;
    const lastId = s.ultimaMensagemId ?? 0;
    const readId = readLastMessageId(user.email, s.id);
    const autor = (s.ultimaAutorEmail ?? '').toLowerCase();
    if (lastId <= readId || autor === meuEmail) return 0;
    return 1;
  }

  const dataLinhaTopo = mensagensFiltradas[0] ? formatDataLinha(mensagensFiltradas[0]!.criadoEm) : 'Conversa';

  return (
    <AppShell>
      <div className="chat-page">
        <aside className="chat-page__list" aria-label="Lista de conversas">
          <div className="chat-page__list-head">
            <h2 className="chat-page__list-title">Mensagens</h2>
            <button
              type="button"
              className="chat-page__list-new"
              onClick={() => (podeCriarCanal ? setModalNovaSala(true) : undefined)}
              disabled={!podeCriarCanal}
              title={podeCriarCanal ? 'Novo canal' : 'Apenas produtor ou gerente pode criar canais'}
              aria-label="Nova conversa"
            >
              +
            </button>
          </div>
          <input
            type="search"
            className="chat-page__list-search"
            placeholder="Buscar canal ou texto…"
            value={buscaLista}
            onChange={(e) => setBuscaLista(e.target.value)}
          />
          <div className="chat-page__filters" role="group" aria-label="Filtro da lista">
            <button type="button" className={filtro === 'todos' ? 'is-active' : ''} onClick={() => setFiltro('todos')}>
              Todos
            </button>
            <button type="button" className={filtro === 'naoLidos' ? 'is-active' : ''} onClick={() => setFiltro('naoLidos')}>
              Não lidos
            </button>
            <button type="button" className={filtro === 'grupos' ? 'is-active' : ''} onClick={() => setFiltro('grupos')}>
              Grupos
            </button>
          </div>
          {loadErr && !salaAtiva ? (
            <p className="muted small" style={{ padding: '0.75rem 1rem' }}>
              {loadErr}
            </p>
          ) : (
            <ul className="chat-page__conversas">
              {salasFiltradas.map((c, i) => {
                const unread = badgeNaoLidas(c);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`chat-conv${salaId === c.id ? ' chat-conv--active' : ''}`}
                      onClick={() => setSalaId(c.id)}
                    >
                      <span
                        className={`chat-conv__avatar ${
                          c.imagemUrl
                            ? 'chat-conv__avatar--photo'
                            : ['chat-conv__avatar--a', 'chat-conv__avatar--b', 'chat-conv__avatar--c'][i % 3]
                        }`}
                        aria-hidden
                      >
                        {c.imagemUrl ? <img src={c.imagemUrl} alt="" loading="lazy" /> : null}
                      </span>
                      <span className="chat-conv__body">
                        <span className="chat-conv__row">
                          <span className="chat-conv__nome">{c.nome}</span>
                          <time className="chat-conv__hora muted small">{horaListaRelativa(c.ultimaEm)}</time>
                        </span>
                        <span className="chat-conv__preview muted small">
                          {c.ultimaPreview ?? 'Nenhuma mensagem ainda.'}
                        </span>
                      </span>
                      {unread > 0 ? (
                        <span className="chat-conv__badge" aria-label="Há mensagens não lidas">
                          {unread}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="chat-page__thread" aria-label="Conversa ativa">
          <header className="chat-thread__head">
            <div>
              <h2 className="chat-thread__title">{salaAtiva?.nome ?? 'Chat'}</h2>
              <p className="chat-thread__meta muted small">
                {membrosCanalLoading
                  ? 'Carregando membros do canal…'
                  : `${membrosCanal.length} pessoa${membrosCanal.length === 1 ? '' : 's'} neste canal`}
              </p>
            </div>
          </header>

          <div style={{ padding: '0 1rem 0.5rem' }}>
            <label className="muted small" htmlFor="chat-busca-thread" style={{ display: 'block', marginBottom: 4 }}>
              Buscar neste canal
            </label>
            <input
              id="chat-busca-thread"
              type="search"
              className="chat-page__list-search"
              style={{ maxWidth: 420 }}
              placeholder="Filtrar mensagens visíveis…"
              value={buscaThread}
              onChange={(e) => setBuscaThread(e.target.value)}
            />
          </div>

          {bootLoading ? (
            <p className="muted" style={{ padding: '1rem' }}>
              Carregando…
            </p>
          ) : (
            <>
              <div className="chat-thread__messages">
                <p className="chat-thread__date muted small">{dataLinhaTopo}</p>
                {mensagensFiltradas.map((msg) => {
                  const outgoing = msg.autorEmail.trim().toLowerCase() === meuEmail;
                  const midia = msg.midiaUrl;
                  const av = (
                    <UserAvatar
                      nome={msg.autorNome}
                      fotoUrl={msg.autorFotoUrl}
                      className="chat-bubble-row__av"
                      label={msg.autorNome}
                    />
                  );
                  return outgoing ? (
                    <div key={msg.id} className="chat-bubble-row chat-bubble-row--out">
                      <div className="chat-bubble chat-bubble--out">
                        {midia ? (
                          isPdfUrl(midia) ? (
                            <p className="chat-bubble__text">
                              <a href={midia} target="_blank" rel="noreferrer">
                                Abrir PDF
                              </a>
                            </p>
                          ) : (
                            <figure className="chat-bubble__figure">
                              <img src={midia} alt="" loading="lazy" />
                            </figure>
                          )
                        ) : null}
                        {msg.texto ? <p className="chat-bubble__text">{msg.texto}</p> : null}
                        <div className="chat-bubble__meta">
                          <time className="chat-bubble__time muted small">{formatHoraMensagem(msg.criadoEm)}</time>
                          <span className="chat-bubble__status chat-bubble__status--enviada" aria-label="Enviada">
                            Enviada
                          </span>
                        </div>
                      </div>
                      <UserAvatar nome={user?.nome ?? msg.autorNome} fotoUrl={user?.fotoUrl ?? msg.autorFotoUrl} className="chat-bubble-row__av" />
                    </div>
                  ) : (
                    <div key={msg.id} className="chat-bubble-row chat-bubble-row--in">
                      {av}
                      <div className="chat-bubble chat-bubble--in">
                        <span className="chat-bubble__author">{msg.autorNome}</span>
                        {midia ? (
                          midia.toLowerCase().endsWith('.pdf') ? (
                            <p className="chat-bubble__text">
                              <a href={midia} target="_blank" rel="noreferrer">
                                Abrir PDF
                              </a>
                            </p>
                          ) : (
                            <figure className="chat-bubble__figure">
                              <img src={midia} alt="" loading="lazy" />
                            </figure>
                          )
                        ) : null}
                        {msg.texto ? <p className="chat-bubble__text">{msg.texto}</p> : null}
                        <time className="chat-bubble__time muted small">{formatHoraMensagem(msg.criadoEm)}</time>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {loadErr ? (
                <p className="muted small" style={{ padding: '0 1rem' }}>
                  {loadErr}
                </p>
              ) : null}
              {sendErr ? (
                <p className="muted small" style={{ padding: '0 1rem', color: 'var(--danger, #b91c1c)' }} role="alert">
                  {sendErr}
                </p>
              ) : null}

              <input ref={fileFotoRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={handleArquivoSelecionado} />
              <input
                ref={fileAnexoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                hidden
                onChange={handleArquivoSelecionado}
              />

              <div className="chat-thread__compose">
                <div className="chat-compose__attach-wrap" ref={attachWrapRef}>
                  <button
                    type="button"
                    className="chat-compose__attach-btn"
                    disabled={sending || salaId == null}
                    aria-expanded={attachMenuOpen}
                    aria-haspopup="menu"
                    aria-label="Anexar arquivo ou foto"
                    title="Anexar"
                    onClick={() => setAttachMenuOpen((o) => !o)}
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                      <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="2" />
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        d="M12 8.25v7.5M8.25 12h7.5"
                      />
                    </svg>
                  </button>
                  {attachMenuOpen ? (
                    <div className="chat-compose__attach-menu" role="menu" aria-label="Tipo de anexo">
                      <button
                        type="button"
                        role="menuitem"
                        className="chat-compose__attach-menu-item"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          fileAnexoRef.current?.click();
                        }}
                      >
                        <span className="chat-compose__attach-menu-icon" aria-hidden>
                          <svg viewBox="0 0 24 24" width="18" height="18">
                            <path
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                            />
                            <path fill="none" stroke="currentColor" strokeWidth="2" d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                          </svg>
                        </span>
                        <span>
                          <strong>Documento</strong>
                          <span className="chat-compose__attach-menu-desc muted small">PDF ou imagem</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="chat-compose__attach-menu-item"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          fileFotoRef.current?.click();
                        }}
                      >
                        <span className="chat-compose__attach-menu-icon" aria-hidden>
                          <svg viewBox="0 0 24 24" width="18" height="18">
                            <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                            <path fill="none" stroke="currentColor" strokeWidth="2" d="m21 15-5-5L5 21" />
                          </svg>
                        </span>
                        <span>
                          <strong>Foto</strong>
                          <span className="chat-compose__attach-menu-desc muted small">JPEG, PNG, WebP ou GIF</span>
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="chat-compose__field">
                  <textarea
                    rows={2}
                    placeholder="Digite uma mensagem"
                    title="Enter envia a mensagem. Shift+Enter quebra linha."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleEnviar();
                      }
                    }}
                    disabled={salaId == null || sending}
                  />
                </div>
                <button
                  type="button"
                  className="chat-compose__send chat-compose__send--icon"
                  disabled={salaId == null || sending || !draft.trim()}
                  onClick={() => void handleEnviar()}
                  aria-label={sending ? 'Enviando mensagem' : 'Enviar mensagem'}
                  title={sending ? 'Enviando…' : 'Enviar'}
                >
                  {sending ? (
                    <span className="chat-compose__send-spinner" aria-hidden />
                  ) : (
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2v7z"
                      />
                    </svg>
                  )}
                </button>
                <p className="chat-compose__hint muted small">
                  Atualização automática a cada poucos segundos. “Não lidos” usa este navegador (localStorage), não outro
                  dispositivo.
                </p>
              </div>
            </>
          )}
        </section>

        <aside className="chat-page__detail" aria-label="Detalhes do canal">
          <div className="chat-detail__hero">
            <button
              type="button"
              className="chat-detail__edit-canal"
              disabled={salaId == null}
              onClick={abrirModalEditarCanal}
              aria-label="Editar nome e foto do canal"
              title="Editar canal"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
                <path
                  fill="currentColor"
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                />
              </svg>
            </button>
            <div className="chat-detail__cover-wrap">
              {salaAtiva?.imagemUrl ? (
                <img
                  className="chat-detail__cover chat-detail__cover--photo"
                  src={salaAtiva.imagemUrl}
                  alt=""
                />
              ) : (
                <div className="chat-detail__cover" aria-hidden />
              )}
            </div>
            <div className="chat-detail__title-stack">
              <h3 className="chat-detail__name">{salaAtiva?.nome ?? 'Canal'}</h3>
              <p className="chat-detail__tipo muted small">
                {membrosCanalLoading
                  ? 'Carregando…'
                  : `${membrosCanal.length} ${membrosCanal.length === 1 ? 'membro' : 'membros'}`}
              </p>
            </div>
            <button
              type="button"
              className="chat-detail__action-busca btn ghost btn-sm"
              disabled={salaId == null}
              onClick={() => document.getElementById('chat-busca-thread')?.focus()}
            >
              Buscar mensagens
            </button>
          </div>

          <section className="chat-detail__block" aria-labelledby="chat-side-membros">
            <div className="chat-detail__block-head">
              <h4 id="chat-side-membros">Neste canal</h4>
              {!membrosCanalLoading ? (
                <span className="muted small chat-detail__count">{membrosCanal.length}</span>
              ) : (
                <span className="muted small chat-detail__count">…</span>
              )}
            </div>
            <input
              type="search"
              className="chat-detail__search chat-page__list-search"
              placeholder="Filtrar por nome ou papel…"
              value={buscaLateralMembros}
              onChange={(e) => setBuscaLateralMembros(e.target.value)}
              disabled={salaId == null || membrosCanalLoading}
              aria-label="Filtrar membros deste canal"
            />
            <div className="chat-detail__members-panel">
              <div className="chat-detail__members-scroll">
                <ul className="chat-detail__members">
                  {membrosCanalLoading ? (
                    <li className="muted small chat-detail__empty">Carregando membros…</li>
                  ) : membrosCanalFiltrados.length === 0 ? (
                    <li className="muted small chat-detail__empty">
                      {membrosCanal.length === 0 ? 'Nenhum membro neste canal.' : 'Ninguém corresponde à busca.'}
                    </li>
                  ) : (
                    membrosCanalFiltrados.map((m) => (
                      <li key={m.id}>
                        <div className="chat-detail__member-row">
                          <UserAvatar nome={m.nome} fotoUrl={m.fotoUrl} className="chat-detail__member-av" />
                          <span className="chat-detail__member-text">
                            <span className="chat-detail__member-name">{m.nome}</span>
                            <span className="muted small chat-detail__member-role">{papelMembroLabel(m)}</span>
                          </span>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <Link to="/equipe" className="btn ghost btn-sm chat-detail__manage">
                Ver equipe completa
              </Link>
            </div>
          </section>

          <section className="chat-detail__block" aria-labelledby="chat-side-midia">
            <div className="chat-detail__block-head">
              <h4 id="chat-side-midia">Mídia recente</h4>
              <span className="muted small chat-detail__count">{midiasRecentes.length || '—'}</span>
            </div>
            {midiasRecentes.length === 0 ? (
              <p className="muted small chat-detail__empty-msg">Nenhuma imagem ainda neste canal.</p>
            ) : (
              <div className="chat-detail__media">
                {midiasRecentes.map((m) =>
                  m.midiaUrl && !isPdfUrl(m.midiaUrl) ? (
                    <a key={m.id} href={m.midiaUrl} target="_blank" rel="noreferrer" className="chat-detail__thumb-wrap">
                      <img src={m.midiaUrl} alt="" className="chat-detail__thumb chat-detail__thumb--photo" width={72} height={72} />
                    </a>
                  ) : m.midiaUrl ? (
                    <a key={m.id} href={m.midiaUrl} target="_blank" rel="noreferrer" className="chat-detail__pdf-tile">
                      PDF
                    </a>
                  ) : null,
                )}
              </div>
            )}
          </section>

          <section className="chat-detail__block chat-detail__block--last" aria-labelledby="chat-side-docs">
            <h4 id="chat-side-docs">PDFs no canal</h4>
            {documentosRecentes.length === 0 ? (
              <p className="muted small chat-detail__empty-msg">Nenhum PDF anexado ainda.</p>
            ) : (
              <ul className="chat-detail__docs">
                {documentosRecentes.map((m) => (
                  <li key={m.id}>
                    <span className="chat-detail__doc-icon">PDF</span>
                    <span className="chat-detail__doc-body">
                      <a href={m.midiaUrl!} target="_blank" rel="noreferrer" className="chat-detail__doc-link">
                        {m.texto?.trim() || 'Arquivo'}
                      </a>
                      <span className="muted small"> · {formatHoraMensagem(m.criadoEm)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {modalNovaSala ? (
        <div className="equipe-modal" role="dialog" aria-modal="true" aria-labelledby="chat-nova-sala-title">
          <button
            type="button"
            className="equipe-modal__backdrop"
            tabIndex={-1}
            aria-label="Fechar"
            onClick={() => !criandoSala && setModalNovaSala(false)}
          />
          <div className="equipe-modal__panel">
            <header className="equipe-modal__head">
              <div className="equipe-modal__head-text">
                <h2 id="chat-nova-sala-title" className="equipe-modal__title">
                  Novo canal
                </h2>
                <p className="equipe-modal__sub muted">
                  Escolha quem participa deste canal (você entra sempre). Apenas produtor ou gerente pode criar.
                </p>
              </div>
              <button type="button" className="equipe-modal__close" disabled={criandoSala} onClick={() => setModalNovaSala(false)} aria-label="Fechar">
                ×
              </button>
            </header>
            <label className="field" style={{ display: 'block', marginBottom: '1rem' }}>
              <span>Nome do canal</span>
              <input
                type="text"
                value={nomeNovaSala}
                onChange={(e) => setNomeNovaSala(e.target.value)}
                placeholder="Ex.: Irrigação — safra"
                maxLength={160}
                disabled={criandoSala}
              />
            </label>
            <div className="field" style={{ marginBottom: '1rem' }}>
              <span>Membros do canal</span>
              <div
                className="muted small"
                style={{ marginBottom: '0.5rem' }}
              >
                Marque quem pode ver e enviar mensagens aqui.
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: '0.25rem 0',
                  maxHeight: 220,
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                {membros
                  .filter((m) => m.ativo)
                  .map((m) => {
                    const meId = usuarioIdFromToken(token);
                    const isSelf = meId != null && m.id === meId;
                    const checked = membrosIdsNovaSala.includes(m.id);
                    return (
                      <li key={m.id} style={{ padding: '0.35rem 0.75rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isSelf ? 'default' : 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={criandoSala || isSelf}
                            onChange={(e) => toggleMembroNovaSala(m.id, e.target.checked, isSelf)}
                          />
                          <span>
                            <strong>{m.nome}</strong>
                            <span className="muted small"> — {papelMembroLabel(m)}</span>
                            {isSelf ? <span className="muted small"> (você)</span> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
              </ul>
            </div>
            <footer className="equipe-modal__footer">
              <button type="button" className="btn ghost" disabled={criandoSala} onClick={() => setModalNovaSala(false)}>
                Cancelar
              </button>
              <button type="button" className="btn primary" disabled={criandoSala || !nomeNovaSala.trim()} onClick={() => void handleCriarSala()}>
                {criandoSala ? 'Criando…' : 'Criar canal'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {modalEditarCanal ? (
        <div className="equipe-modal" role="dialog" aria-modal="true" aria-labelledby="chat-edit-sala-title">
          <button
            type="button"
            className="equipe-modal__backdrop"
            tabIndex={-1}
            aria-label="Fechar"
            onClick={() => !editCanalSaving && setModalEditarCanal(false)}
          />
          <div className="equipe-modal__panel">
            <header className="equipe-modal__head">
              <div className="equipe-modal__head-text">
                <h2 id="chat-edit-sala-title" className="equipe-modal__title">
                  Editar canal
                </h2>
                <p className="equipe-modal__sub muted">Nome e foto do grupo. JPEG, PNG, WebP ou GIF até 5 MB.</p>
              </div>
              <button
                type="button"
                className="equipe-modal__close"
                disabled={editCanalSaving}
                onClick={() => setModalEditarCanal(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>
            <label className="field" style={{ display: 'block', marginBottom: '1rem' }}>
              <span>Nome do canal</span>
              <input
                type="text"
                value={editCanalNome}
                onChange={(e) => setEditCanalNome(e.target.value)}
                placeholder="Nome do grupo"
                maxLength={160}
                disabled={editCanalSaving}
                autoComplete="off"
              />
            </label>
            <div className="field" style={{ marginBottom: '1rem' }}>
              <span>Foto do grupo</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  ref={editCanalFotoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  className="visually-hidden"
                  tabIndex={-1}
                  aria-hidden
                  onChange={handleEditCanalFotoChange}
                />
                <button
                  type="button"
                  className="btn ghost btn-sm"
                  disabled={editCanalSaving}
                  onClick={() => editCanalFotoRef.current?.click()}
                >
                  Escolher imagem…
                </button>
                {editCanalFotoLabel ? (
                  <span className="muted small" style={{ flex: '1 1 100%' }}>
                    {editCanalFotoLabel}
                  </span>
                ) : (
                  <span className="muted small">Opcional — deixe em branco para manter a atual.</span>
                )}
              </div>
            </div>
            {editCanalErr ? (
              <p className="muted small" style={{ marginBottom: '1rem', color: 'var(--danger, #b91c1c)' }} role="alert">
                {editCanalErr}
              </p>
            ) : null}
            <footer className="equipe-modal__footer">
              <button type="button" className="btn ghost" disabled={editCanalSaving} onClick={() => setModalEditarCanal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn primary" disabled={editCanalSaving} onClick={() => void handleSalvarEdicaoCanal()}>
                {editCanalSaving ? 'Salvando…' : 'Salvar'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
