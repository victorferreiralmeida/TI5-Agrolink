import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { AppShell } from '../components/AppShell';
import { UserAvatar } from '../components/UserAvatar';
import { IconCheck } from '../components/icons/SystemIcons';
import { useAuth } from '../auth/AuthContext';
import type { ConviteDto, EquipeResumoDto, MembroDto } from '../api/equipeApi';
import {
  cancelarConvite,
  convidarMembro,
  fetchEquipeResumo,
  reenviarConvite,
  removerMembro,
} from '../api/equipeApi';

type PapelUi = 'Gerente' | 'Funcionário' | 'Produtor';

function papelApiParaUi(papel: string): PapelUi {
  if (papel === 'GERENTE') return 'Gerente';
  if (papel === 'FUNCIONARIO_CAMPO') return 'Funcionário';
  return 'Produtor';
}

function badgeModifier(m: MembroDto): 'gerente' | 'op' | 'prod' {
  if (m.papel === 'GERENTE') return 'gerente';
  if (m.papel === 'FUNCIONARIO_CAMPO') return 'op';
  return 'prod';
}

function formatIngresso(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatEnvio(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function destinoConvite(c: ConviteDto): string {
  if (c.email?.trim()) return c.email.trim();
  return '—';
}

function normalizarEmailConvite(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t || !t.includes('@')) return null;
  return t;
}

type TabId = 'todos' | 'gerentes' | 'funcionarios';

type CargoConvite = 'gerente' | 'funcionario';

function IconUserPlus() {
  return (
    <svg className="equipe-modal__title-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
      />
      <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function RoleIconGerente() {
  return (
    <svg className="equipe-modal__role-svg" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        d="M12 4l1.2 3h3.8l-3 2.2 1.1 3.3L12 11l-3.1 1.5 1.1-3.3-3-2.2h3.8L12 4zM8 21h8M9 17v4M15 17v4"
      />
    </svg>
  );
}

function RoleIconFuncionario() {
  return (
    <svg className="equipe-modal__role-svg" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        d="M5 21v-1a5 5 0 0 1 5-5h.5"
      />
    </svg>
  );
}

const ROLES: { id: CargoConvite; label: string; Icon: () => ReactElement }[] = [
  { id: 'gerente', label: 'Gerente', Icon: RoleIconGerente },
  { id: 'funcionario', label: 'Funcionário', Icon: RoleIconFuncionario },
];

export function EquipePage() {
  const { user, token } = useAuth();
  const podeGerir = user?.papel === 'PRODUTOR' || user?.papel === 'GERENTE';

  const [tab, setTab] = useState<TabId>('todos');
  const [resumo, setResumo] = useState<EquipeResumoDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [emailConvite, setEmailConvite] = useState('');
  const [cargoConvite, setCargoConvite] = useState<CargoConvite>('gerente');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSentEmail, setInviteSentEmail] = useState<string | null>(null);
  const [busyMembroId, setBusyMembroId] = useState<number | null>(null);
  const [busyConviteId, setBusyConviteId] = useState<number | null>(null);

  const recarregar = useCallback(async () => {
    if (!token) {
      setResumo(null);
      return;
    }
    setError(null);
    const data = await fetchEquipeResumo(token);
    setResumo(data);
  }, [token]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    recarregar()
      .catch((e: unknown) => {
        if (!cancel) setError(e instanceof Error ? e.message : 'Não foi possível carregar a equipe.');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [recarregar]);

  const membros = resumo?.membros ?? [];
  const convites = resumo?.convitesPendentes ?? [];

  const tabs = useMemo(() => {
    const nGer = membros.filter((m) => m.papel === 'GERENTE').length;
    const nOp = membros.filter((m) => m.papel === 'FUNCIONARIO_CAMPO').length;
    return [
      { id: 'todos' as const, label: 'Todos', count: membros.length },
      { id: 'gerentes' as const, label: 'Gerentes', count: nGer },
      { id: 'funcionarios' as const, label: 'Funcionários', count: nOp },
    ];
  }, [membros]);

  const visiveis = useMemo(() => {
    if (tab === 'todos') return membros;
    if (tab === 'gerentes') return membros.filter((m) => m.papel === 'GERENTE');
    return membros.filter((m) => m.papel === 'FUNCIONARIO_CAMPO');
  }, [tab, membros]);

  const closeAdd = useCallback(() => {
    setAddOpen(false);
    setEmailConvite('');
    setCargoConvite('gerente');
    setInviteSending(false);
    setInviteSentEmail(null);
  }, []);

  useEffect(() => {
    if (!addOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [addOpen]);

  useEffect(() => {
    if (!addOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAdd();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addOpen, closeAdd]);

  async function handleEnviarConvite() {
    if (!podeGerir) return;
    const email = normalizarEmailConvite(emailConvite);
    if (!email) {
      setError('Informe o e-mail do convidado (obrigatório).');
      return;
    }
    const papel = cargoConvite === 'gerente' ? 'GERENTE' : 'FUNCIONARIO_CAMPO';
    setInviteSending(true);
    setError(null);
    try {
      await convidarMembro({ email, telefone: null, papel }, token);
      await recarregar();
      setInviteSentEmail(email);
      setEmailConvite('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao enviar convite.');
    } finally {
      setInviteSending(false);
    }
  }

  async function handleRemoverMembro(m: MembroDto) {
    if (!podeGerir || m.papel === 'PRODUTOR' || !token) return;
    if (user?.papel === 'GERENTE' && user.id === m.id) return;
    if (!window.confirm(`Remover ${m.nome} da equipe? A pessoa perde o acesso a esta fazenda; a conta Agrolink continua ativa.`)) return;
    setBusyMembroId(m.id);
    setError(null);
    try {
      await removerMembro(m.id, token);
      await recarregar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível remover o membro.');
    } finally {
      setBusyMembroId(null);
    }
  }

  async function handleReenviarConvite(id: number) {
    if (!podeGerir || !token) return;
    setBusyConviteId(id);
    setError(null);
    try {
      await reenviarConvite(id, token);
      await recarregar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível reenviar.');
    } finally {
      setBusyConviteId(null);
    }
  }

  async function handleCancelarConvite(id: number) {
    if (!podeGerir || !token) return;
    if (!window.confirm('Cancelar este convite?')) return;
    setBusyConviteId(id);
    setError(null);
    try {
      await cancelarConvite(id, token);
      await recarregar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível cancelar.');
    } finally {
      setBusyConviteId(null);
    }
  }

  const vagasTexto = resumo
    ? `${resumo.vagasOcupadas} vagas ocupadas de ${resumo.capacidadeMaxima}.`
    : 'Carregando vagas…';

  return (
    <AppShell>
      <div className="equipe-page">
        <header className="equipe-page__head">
          <div className="equipe-page__head-text">
            <h1 className="equipe-page__title">Gestão de Equipe</h1>
            <p className="equipe-page__subtitle muted">
              Gerencie membros, envie convites e acompanhe pendentes. Quem altera a equipe é o <strong>produtor</strong>{' '}
              (dono) ou o <strong>gerente</strong>; <strong>funcionários de campo</strong> só visualizam.
            </p>
          </div>
          <button
            type="button"
            className="btn primary equipe-page__cta"
            onClick={() => setAddOpen(true)}
            disabled={!podeGerir || loading}
            title={!podeGerir ? 'Apenas produtor ou gerente podem convidar.' : undefined}
          >
            + Adicionar membro
          </button>
        </header>

        {!podeGerir ? (
          <p className="muted small equipe-page__notice" style={{ margin: '0 0 1rem' }}>
            Sua conta é de <strong>funcionário de campo</strong>: você pode ver a equipe, mas não alterar membros nem
            convites.
          </p>
        ) : null}

        {error ? (
          <p className="equipe-page__error" role="alert" style={{ margin: '0 0 1rem', color: 'var(--danger, #b91c1c)' }}>
            {error}
          </p>
        ) : null}

        <div className="equipe-page__toolbar">
          <div className="equipe-page__tabs" role="tablist" aria-label="Filtrar por função">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`equipe-page__tab${tab === t.id ? ' equipe-page__tab--active' : ''}`}
                onClick={() => setTab(t.id)}
                disabled={loading}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
          <p className="equipe-page__slots muted small">{vagasTexto}</p>
        </div>

        {loading ? (
          <p className="muted">Carregando equipe…</p>
        ) : visiveis.length === 0 ? (
          <p className="muted" style={{ margin: '0 0 1rem' }}>
            Nenhum membro na sua equipe ainda.
            {podeGerir ? ' Use “+ Adicionar membro” para enviar convites.' : ''}
          </p>
        ) : null}
        {!loading && visiveis.length > 0 ? (
          <div className="equipe-page__grid">
            {visiveis.map((m, idx) => {
              const uiPapel = papelApiParaUi(m.papel);
              const badge = badgeModifier(m);
              const gerenteNaoPodeAutoRemover = user?.papel === 'GERENTE' && user.id === m.id;
              return (
                <article key={m.id} className="equipe-card">
                  <div className="equipe-card__top">
                    <div className="equipe-card__photo-wrap">
                      <UserAvatar
                        nome={m.nome}
                        fotoUrl={m.fotoUrl}
                        className={`equipe-card__user-av equipe-card__user-av--${(['a', 'b', 'c', 'd'] as const)[idx % 4]}`}
                      />
                      <span className="equipe-card__online" title="Online" aria-label="Online" />
                    </div>
                    <button type="button" className="equipe-card__menu" aria-label="Opções do membro" disabled title="—">
                      ⋮
                    </button>
                  </div>
                  <h2 className="equipe-card__nome">{m.nome}</h2>
                  <p>
                    <span className={`equipe-card__badge equipe-card__badge--${badge}`}>{uiPapel}</span>
                  </p>
                  <p className="equipe-card__desde muted small">Desde {formatIngresso(m.dataIngresso)}</p>
                  <div className="equipe-card__contacts">
                    <p className="equipe-card__contact">
                      <span className="equipe-card__contact-ic" aria-hidden>
                        ✉
                      </span>
                      <span>{m.email}</span>
                    </p>
                    <p className="equipe-card__contact">
                      <span className="equipe-card__contact-ic" aria-hidden>
                        ☎
                      </span>
                      <span>{m.telefone?.trim() ? m.telefone : '—'}</span>
                    </p>
                  </div>
                  {podeGerir && m.papel !== 'PRODUTOR' ? (
                    <button
                      type="button"
                      className="btn ghost equipe-card__perfil"
                      disabled={busyMembroId === m.id || gerenteNaoPodeAutoRemover}
                      title={
                        gerenteNaoPodeAutoRemover
                          ? 'Peça ao produtor para remover você da equipe.'
                          : undefined
                      }
                      onClick={() => handleRemoverMembro(m)}
                    >
                      {busyMembroId === m.id ? 'Removendo…' : 'Remover da equipe'}
                    </button>
                  ) : (
                    <button type="button" className="btn ghost equipe-card__perfil" disabled title="—">
                      Ver perfil completo
                    </button>
                  )}
                </article>
              );
            })}

            {podeGerir ? (
              <button
                type="button"
                className="equipe-card equipe-card--invite"
                onClick={() => {
                  setCargoConvite('funcionario');
                  setAddOpen(true);
                }}
              >
                <span className="equipe-card--invite__plus" aria-hidden>
                  +
                </span>
                <span className="equipe-card--invite__label">Convidar novo funcionário</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && visiveis.length === 0 && podeGerir ? (
          <div className="equipe-page__grid">
            <button
              type="button"
              className="equipe-card equipe-card--invite"
              onClick={() => {
                setCargoConvite('funcionario');
                setAddOpen(true);
              }}
            >
              <span className="equipe-card--invite__plus" aria-hidden>
                +
              </span>
              <span className="equipe-card--invite__label">Convidar novo funcionário</span>
            </button>
          </div>
        ) : null}

        <section className="equipe-invites" aria-labelledby="equipe-invites-heading">
          <h2 id="equipe-invites-heading" className="equipe-invites__title">
            <span className="equipe-invites__title-ic" aria-hidden>
              ⏱
            </span>
            Convites pendentes
          </h2>
          {convites.length === 0 ? (
            <p className="muted small" style={{ margin: '0.5rem 0 0' }}>
              Nenhum convite pendente.
            </p>
          ) : (
            <ul className="equipe-invites__list">
              {convites.map((c) => {
                const papelUi = papelApiParaUi(c.papel);
                const badge = c.papel === 'GERENTE' ? 'gerente' : 'op';
                const busy = busyConviteId === c.id;
                return (
                  <li key={c.id} className="equipe-invite-row">
                    <span className="equipe-invite-row__clock" aria-hidden>
                      🕐
                    </span>
                    <div className="equipe-invite-row__body">
                      <p className="equipe-invite-row__dest">{destinoConvite(c)}</p>
                      <p className="equipe-invite-row__meta muted small">
                        <span className={`equipe-card__badge equipe-card__badge--${badge}`}>{papelUi}</span>
                        <span> · Enviado em {formatEnvio(c.dataEnvio)}</span>
                      </p>
                    </div>
                    <div className="equipe-invite-row__actions">
                      <button
                        type="button"
                        className="btn ghost btn-sm equipe-invite-row__btn"
                        disabled={!podeGerir || busy}
                        title={!podeGerir ? 'Sem permissão' : undefined}
                        onClick={() => handleReenviarConvite(c.id)}
                      >
                        ↻ {busy ? '…' : 'Reenviar'}
                      </button>
                      <button
                        type="button"
                        className="equipe-invite-row__cancel"
                        aria-label="Cancelar convite"
                        disabled={!podeGerir || busy}
                        title={!podeGerir ? 'Sem permissão' : 'Cancelar convite'}
                        onClick={() => handleCancelarConvite(c.id)}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="equipe-security" role="status">
          <span className="equipe-security__ic" aria-hidden>
            🛡
          </span>
          <div>
            <strong>Segurança de convite</strong>
            <p className="equipe-security__text muted small">
              Os convites expiram em 48 horas. Se necessário, use &quot;Reenviar&quot; para gerar um novo prazo.
            </p>
          </div>
        </div>

        <footer className="equipe-page__footer muted small">
          <span>© 2026 AGROLINK — Gestão rural inteligente</span>
          <span className="equipe-page__footer-links">
            <span>Suporte</span>
            <span>·</span>
            <span>Termos de uso</span>
            <span>·</span>
            <span>Privacidade</span>
          </span>
        </footer>

        {addOpen ? (
          <div className="equipe-modal" role="dialog" aria-modal="true" aria-labelledby="equipe-modal-title">
            <button type="button" className="equipe-modal__backdrop" tabIndex={-1} aria-label="Fechar" onClick={closeAdd} />
            <div className="equipe-modal__panel">
              {inviteSentEmail ? (
                <>
                  <header className="equipe-modal__head">
                    <div className="equipe-modal__head-text">
                      <h2 id="equipe-modal-title" className="equipe-modal__title">
                        <IconCheck width={22} height={22} className="equipe-modal__send-ic" />
                        Convite enviado
                      </h2>
                      <p className="equipe-modal__sub muted">
                        O convite foi enviado para <strong>{inviteSentEmail}</strong>. A pessoa verá o convite no sino
                        de notificações ao entrar com esse e-mail e poderá aceitar ou recusar.
                      </p>
                    </div>
                  </header>
                  <footer className="equipe-modal__footer">
                    <button type="button" className="btn primary equipe-modal__send" onClick={closeAdd}>
                      Ok
                    </button>
                  </footer>
                </>
              ) : (
                <>
              <header className="equipe-modal__head">
                <div className="equipe-modal__head-text">
                  <h2 id="equipe-modal-title" className="equipe-modal__title">
                    <IconUserPlus />
                    Adicionar novo membro
                  </h2>
                  <p className="equipe-modal__sub muted">
                    O convidado recebe um convite pendente. Com o <strong>mesmo e-mail</strong> da conta Agrolink, ele vê
                    no <strong>sino</strong> (convites e notificações) e pode aceitar ou recusar. Ao aceitar, passa a
                    enxergar esta fazenda. Convites expiram em 48 horas.
                  </p>
                </div>
                <button type="button" className="equipe-modal__close" onClick={closeAdd} aria-label="Fechar">
                  ×
                </button>
              </header>

              <div className="equipe-modal__fields">
                <label className="field">
                  <span>E-mail</span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="ex.: maria@email.com"
                    value={emailConvite}
                    onChange={(e) => setEmailConvite(e.target.value)}
                  />
                </label>
              </div>
              <p className="muted small" style={{ margin: '0 0 0.75rem' }}>
                <strong>Importante:</strong> use o <strong>e-mail</strong> que a pessoa usa (ou vai usar) no cadastro
                Agrolink — o convite aparece no sino dessa conta.
              </p>

              <div className="equipe-modal__block">
                <p className="equipe-modal__label">Cargo e função</p>
                <div className="equipe-modal__roles" role="group" aria-label="Cargo e função">
                  {ROLES.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={`equipe-modal__role${cargoConvite === id ? ' equipe-modal__role--selected' : ''}`}
                      onClick={() => setCargoConvite(id)}
                      aria-pressed={cargoConvite === id}
                    >
                      <Icon />
                      <span className="equipe-modal__role-label">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="equipe-modal__block equipe-modal__hint" role="note">
                <p className="equipe-modal__label">O que acontece depois</p>
                <ul className="equipe-modal__hint-list muted small">
                  <li>O convite aparece na lista desta página enquanto estiver pendente.</li>
                  <li>Na conta do convidado: seção de convites no sino + notificação (quando aplicável).</li>
                  <li>Ao aceitar, o vínculo com esta fazenda é criado e o papel escolhido (gerente ou funcionário) é aplicado.</li>
                </ul>
              </div>

              <footer className="equipe-modal__footer">
                <button type="button" className="btn ghost equipe-modal__cancel" onClick={closeAdd} disabled={inviteSending}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn primary equipe-modal__send"
                  onClick={() => void handleEnviarConvite()}
                  disabled={inviteSending}
                >
                  <IconCheck width={18} height={18} className="equipe-modal__send-ic" />
                  {inviteSending ? 'Enviando…' : 'Enviar convite'}
                </button>
              </footer>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
