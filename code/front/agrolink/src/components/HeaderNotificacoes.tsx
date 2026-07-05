import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fetchNotificacoes, type NotificacaoDto } from '../api/notificacoesApi';
import {
  aceitarConviteEquipe,
  fetchMeusConvites,
  recusarConviteEquipe,
  type ConviteDto,
} from '../api/equipeApi';
import { usuarioIdFromToken } from '../api/chatApi';
import { IconAgrolink, IconBell } from './icons/SystemIcons';

const POLL_MS = 40_000;

function readIdsStorageKey(userId: number) {
  return `agrolink_notif_lidas_${userId}`;
}

function loadReadSet(userId: number): Set<number> {
  try {
    const raw = localStorage.getItem(readIdsStorageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is number => typeof x === 'number'));
  } catch {
    return new Set();
  }
}

function saveReadSet(userId: number, set: Set<number>) {
  localStorage.setItem(readIdsStorageKey(userId), JSON.stringify([...set]));
}

function tempoRelativo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diffMin = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (diffMin < 60) return `há ${diffMin} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'Ontem';
  return `há ${d} dias`;
}

function NotifIcon({ kind }: { kind: NotificacaoDto['icon'] }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75 };
  switch (kind) {
    case 'alert':
      return (
        <svg {...common} className="notif-row__ic notif-row__ic--alert" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common} className="notif-row__ic notif-row__ic--user" aria-hidden>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 20v-1a5 5 0 0 1 5-5h.2M16 11h6M19 8v6" strokeLinecap="round" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...common} className="notif-row__ic notif-row__ic--chat" aria-hidden>
          <path d="M4 6h16v10H9l-4 3V6z" strokeLinejoin="round" />
        </svg>
      );
    case 'sync':
      return (
        <svg {...common} className="notif-row__ic notif-row__ic--sync" aria-hidden>
          <path
            d="M4 12a8 8 0 0 1 8-8V2l3 3-3 3V6a6 6 0 0 0-6 6M20 12a8 8 0 0 1-8 8v2l-3-3 3-3v2a6 6 0 0 0 6-6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'wrench':
      return (
        <svg {...common} className="notif-row__ic notif-row__ic--wrench" aria-hidden>
          <path d="M14.7 6.3a6 6 0 0 1 0 8.5L10 19.5 4.5 14l4.7-4.7a6 6 0 0 1 8.5 0zM6 18l3 3" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function HeaderNotificacoes() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<NotificacaoDto[]>([]);
  const [convites, setConvites] = useState<ConviteDto[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [erroConvite, setErroConvite] = useState<string | null>(null);
  const [busyConviteId, setBusyConviteId] = useState<number | null>(null);
  const userId = usuarioIdFromToken(token);
  const [readIds, setReadIds] = useState<Set<number>>(() => (userId != null ? loadReadSet(userId) : new Set()));
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userId == null) {
      setReadIds(new Set());
      return;
    }
    setReadIds(loadReadSet(userId));
  }, [userId]);

  const carregar = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      setErro(null);
      const data = await fetchNotificacoes(token, { silent });
      setItens(data);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar notificações.');
    }
  }, [token]);

  const carregarConvites = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      setErroConvite(null);
      const data = await fetchMeusConvites(token, { silent });
      setConvites(data);
    } catch (e: unknown) {
      setErroConvite(e instanceof Error ? e.message : 'Falha ao carregar convites.');
      setConvites([]);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void carregar(false);
    void carregarConvites(false);
    const id = window.setInterval(() => {
      void carregar(true);
      void carregarConvites(true);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [token, carregar, carregarConvites]);

  useEffect(() => {
    if (!aberto) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [aberto]);

  const naoLidas = useMemo(() => {
    return convites.length + itens.filter((n) => !readIds.has(n.id)).length;
  }, [convites.length, itens, readIds]);

  const convitePapelLabel = (papel: string) => (papel === 'GERENTE' ? 'Gerente' : 'Funcionário');

  const aceitarConvite = async (id: number) => {
    if (!token) return;
    setBusyConviteId(id);
    setErroConvite(null);
    try {
      await aceitarConviteEquipe(id, token);
      await carregarConvites();
      await carregar();
    } catch (e: unknown) {
      setErroConvite(e instanceof Error ? e.message : 'Falha ao aceitar convite.');
    } finally {
      setBusyConviteId(null);
    }
  };

  const recusarConvite = async (id: number) => {
    if (!token) return;
    setBusyConviteId(id);
    setErroConvite(null);
    try {
      await recusarConviteEquipe(id, token);
      await carregarConvites();
    } catch (e: unknown) {
      setErroConvite(e instanceof Error ? e.message : 'Falha ao recusar convite.');
    } finally {
      setBusyConviteId(null);
    }
  };

  const marcarTodasLidas = () => {
    if (!userId || itens.length === 0) return;
    const next = new Set(readIds);
    for (const n of itens) next.add(n.id);
    setReadIds(next);
    saveReadSet(userId, next);
  };

  const marcarLida = (id: number) => {
    if (!userId) return;
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadSet(userId, next);
  };

  const aoClicarItem = (n: NotificacaoDto) => {
    marcarLida(n.id);
    setAberto(false);
    if (n.refTipo === 'OCORRENCIA' && n.refId != null) {
      navigate(`/ocorrencias/${n.refId}`);
      return;
    }
    if (n.refTipo === 'FAZENDA' || n.tipo.startsWith('FAZENDA') || n.tipo.startsWith('SETOR')) {
      navigate('/fazenda');
      return;
    }
    if (n.refTipo === 'CONVITE' || n.tipo.startsWith('CONVITE') || n.tipo.startsWith('MEMBRO')) {
      navigate('/equipe');
    }
  };

  if (!token || userId == null) return null;

  return (
    <div className="header-notif" ref={wrapRef}>
      <button
        type="button"
        className="header-notif__bell"
        aria-label={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : 'Notificações'}
        aria-expanded={aberto}
        onClick={() => {
          setAberto((v) => !v);
          if (!aberto) {
            void carregar();
            void carregarConvites();
          }
        }}
      >
        <IconBell width={22} height={22} />
        {naoLidas > 0 ? <span className="header-notif__badge" aria-hidden /> : null}
      </button>

      {aberto ? (
        <div className="header-notif__panel" role="dialog" aria-label="Painel de notificações">
          <header className="header-notif__brand">
            <div className="header-notif__brand-left">
              <span className="header-notif__logo" aria-hidden>
                <IconAgrolink width={18} height={18} />
              </span>
              <span className="header-notif__name">AGROLINK</span>
            </div>
            <button type="button" className="header-notif__close" onClick={() => setAberto(false)} aria-label="Fechar">
              ×
            </button>
          </header>

          <div className="header-notif__head">
            <h2 className="header-notif__title">Notificações</h2>
            <button type="button" className="header-notif__markall" onClick={marcarTodasLidas} disabled={itens.length === 0}>
              Marcar todas como lidas
            </button>
          </div>

          <div className="header-notif__body">
            {convites.length > 0 ? (
              <section className="header-notif__invites" aria-label="Convites pendentes">
                <p className="header-notif__invites-title">Convites para entrar em fazenda</p>
                <ul className="header-notif__invites-list">
                  {convites.map((c) => {
                    const busy = busyConviteId === c.id;
                    const expira = Date.parse(c.dataExpiracao);
                    const expiraTxt = Number.isNaN(expira)
                      ? c.dataExpiracao
                      : new Date(expira).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                    return (
                      <li key={c.id} className="header-notif__invite-row">
                        <p className="header-notif__invite-main">
                          Convite para atuar como <strong>{convitePapelLabel(c.papel)}</strong>
                        </p>
                        <p className="muted small">Expira em {expiraTxt}</p>
                        <div className="header-notif__invite-actions">
                          <button type="button" className="btn ghost btn-sm" disabled={busy} onClick={() => void recusarConvite(c.id)}>
                            Recusar
                          </button>
                          <button type="button" className="btn primary btn-sm" disabled={busy} onClick={() => void aceitarConvite(c.id)}>
                            {busy ? 'Processando…' : 'Aceitar'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {erroConvite ? (
              <p className="header-notif__erro muted small" role="alert">
                {erroConvite}
              </p>
            ) : null}

            <div className="header-notif__context">
              <span className="header-notif__context-arrow" aria-hidden>
                ›
              </span>
              <div>
                <p className="header-notif__context-label muted small">Área atual</p>
                <p className="header-notif__context-value">Atividade da equipe e da fazenda</p>
              </div>
            </div>

            {erro ? (
              <p className="header-notif__erro muted small" role="alert">
                {erro}
              </p>
            ) : null}

            <ul className="header-notif__list">
              {itens.length === 0 && !erro ? (
                <li className="header-notif__empty muted small">Nenhuma notificação recente.</li>
              ) : null}
              {itens.map((item) => {
                const unread = !readIds.has(item.id);
                return (
                  <li key={item.id}>
                    <button type="button" className="header-notif__row" onClick={() => aoClicarItem(item)}>
                      <NotifIcon kind={item.icon} />
                      <div className="header-notif__row-body">
                        <span className={`notif-row__tag notif-row__tag--${item.tagTone}`}>{item.tag}</span>
                        <p className="notif-row__titulo">{item.mensagem || item.titulo}</p>
                        <p className="notif-row__tempo muted small">{tempoRelativo(item.criadoEm)}</p>
                      </div>
                      {unread ? (
                        <span
                          className={`notif-row__dot notif-row__dot--${item.tagTone === 'danger' ? 'danger' : 'ok'}`}
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <Link to="/notificacoes" className="header-notif__footer" onClick={() => setAberto(false)}>
            Ver central de notificações
          </Link>
          <Link to="/ocorrencias" className="header-notif__history muted" onClick={() => setAberto(false)}>
            Ver histórico de ocorrências
          </Link>
        </div>
      ) : null}
    </div>
  );
}
