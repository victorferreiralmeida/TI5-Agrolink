import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconSquircle } from '../components/IconSquircle';
import { ThemeToggle } from '../components/ThemeToggle';
import {
  IconAgrolink,
  IconDecisao,
  IconEquipe,
  IconFuncionario,
  IconGerente,
  IconOcorrencias,
  IconTractor,
} from '../components/icons/SystemIcons';

const STEPS = [
  {
    n: 1,
    title: 'Crie sua conta',
    text: 'Escolha o perfil — produtor, gerente ou funcionário de campo — e entre com segurança.',
  },
  {
    n: 2,
    title: 'Registre ocorrências',
    text: 'Título, setor, categoria e local no mapa: tudo organizado para quem decide no escritório ou no talhão.',
  },
  {
    n: 3,
    title: 'Acompanhe e resolva',
    text: 'Prioridades, status, comentários e histórico num só fluxo, sem perder o fio à meada.',
  },
] as const;

const ROLE_CARDS = [
  {
    id: 'produtor',
    title: 'Produtor',
    text: 'Visão da propriedade, operações e indicadores para enxergar o que importa.',
    icon: <IconTractor />,
  },
  {
    id: 'gerente',
    title: 'Gerente',
    text: 'Coordena prioridades, equipe e o acompanhamento das ocorrências em tempo hábil.',
    icon: <IconGerente />,
  },
  {
    id: 'campo',
    title: 'Funcionário de campo',
    text: 'Registro direto do dia a dia no campo, com clareza para quem trata o caso.',
    icon: <IconFuncionario />,
  },
] as const;

function LandingNav({ authenticated }: { authenticated: boolean }) {
  const { logout } = useAuth();
  return (
    <header className="home-landing-nav">
      <div className={`home-landing-nav__inner${authenticated ? ' home-landing-nav__inner--auth' : ''}`}>
        <Link to="/" className="home-landing-nav__brand">
          <IconSquircle tone="accent" size="sm">
            <IconAgrolink />
          </IconSquircle>
          <span className="home-landing-nav__wordmark">Agrolink</span>
        </Link>
        {!authenticated ? (
          <nav className="home-landing-nav__anchors" aria-label="Seções da página inicial">
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#perfis">Perfis</a>
          </nav>
        ) : null}
        <div className="home-landing-nav__actions">
          {authenticated ? (
            <>
              <Link to="/dashboard" className="home-landing-nav__link">
                Painel
              </Link>
              <button type="button" className="home-landing-nav__link home-landing-nav__link--btn" onClick={logout}>
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="home-landing-nav__link">
                Entrar
              </Link>
              <Link to="/cadastro" className="home-landing-nav__pill">
                Criar conta
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function HeroPreview() {
  return (
    <div className="home-hero-preview" aria-hidden>
      <div className="home-hero-preview__chrome">
        <span className="home-hero-preview__dot" />
        <span className="home-hero-preview__dot" />
        <span className="home-hero-preview__dot" />
        <span className="home-hero-preview__title">Agrolink</span>
      </div>
      <div className="home-hero-preview__body">
        <div className="home-hero-preview__row home-hero-preview__row--head">
          <span>Ocorrências</span>
          <span className="home-hero-preview__pill">Ao vivo</span>
        </div>
        <div className="home-hero-preview__row">
          <span className="home-hero-preview__badge home-hero-preview__badge--alta" />
          <span>Praga detectada — Setor Leste</span>
        </div>
        <div className="home-hero-preview__row">
          <span className="home-hero-preview__badge home-hero-preview__badge--media" />
          <span>Irrigação — revisão agendada</span>
        </div>
        <div className="home-hero-preview__row">
          <span className="home-hero-preview__badge home-hero-preview__badge--ok" />
          <span>Equipamento — manutenção concluída</span>
        </div>
        <div className="home-hero-preview__map">
          <span className="home-hero-preview__map-label">Vista mapa</span>
          <div className="home-hero-preview__map-base" aria-hidden />
          <div className="home-hero-preview__map-parcels" aria-hidden />
          <div className="home-hero-preview__map-path" aria-hidden />
          <div className="home-hero-preview__map-grid" aria-hidden />
          <span className="home-hero-preview__map-pin" aria-hidden>
            <span className="home-hero-preview__map-pin-dot" />
          </span>
        </div>
      </div>
    </div>
  );
}

const LANDING_SMOOTH_SCROLL_CLASS = 'home-landing-smooth-scroll';

export function HomePage() {
  const { token } = useAuth();
  const authenticated = Boolean(token);

  useEffect(() => {
    document.documentElement.classList.add(LANDING_SMOOTH_SCROLL_CLASS);
    return () => document.documentElement.classList.remove(LANDING_SMOOTH_SCROLL_CLASS);
  }, []);

  return (
    <div className="home-landing-root">
      <LandingNav authenticated={authenticated} />
      <div className="home-hero-banner">
        <div className="home-hero-banner__media" aria-hidden />
        <div className="home-hero-banner__content">
          <div className="home-hero-banner__max">
            <section
              className="home-hero home-hero--split home-hero--on-photo"
              aria-labelledby="home-hero-title"
            >
              <div className="home-hero__copy">
                <p className="home-eyebrow home-eyebrow--on-photo">Gestão conectada ao campo</p>
                <h1 id="home-hero-title">Do campo ao painel: tudo sob controle.</h1>
                <p className="home-lead home-lead--on-photo">
                  O Agrolink reúne o que acontece na fazenda com quem precisa decidir: registro com
                  localização, perfis por função e trilha clara até a resolução.
                </p>
                <div className="home-cta home-cta--on-photo">
                  {authenticated ? (
                    <Link to="/dashboard" className="btn primary">
                      Ir para o dashboard
                    </Link>
                  ) : (
                    <>
                      <Link to="/cadastro" className="btn primary">
                        Criar conta grátis
                      </Link>
                      <Link to="/login" className="btn ghost btn--on-hero">
                        Entrar
                      </Link>
                      <a href="#recursos" className="btn ghost btn--on-hero home-cta__secondary">
                        Ver recursos
                      </a>
                    </>
                  )}
                </div>
                <ul className="home-trust home-trust--on-photo small">
                  <li>Registro com mapa e geolocalização</li>
                  <li>Perfis: produtor, gerente e campo</li>
                  <li>Chat e notificações em evolução</li>
                </ul>
              </div>
              <HeroPreview />
            </section>
          </div>
        </div>
      </div>

      <div className="home-page home-page--landing">
        <section className="home-metrics" aria-label="Destaques">
          <div className="home-metrics__item">
            <strong className="home-metrics__value">1 fluxo</strong>
            <span className="muted small">Da abertura à resolução</span>
          </div>
          <div className="home-metrics__item">
            <strong className="home-metrics__value">100%</strong>
            <span className="muted small">Rastreável por ocorrência</span>
          </div>
          <div className="home-metrics__item">
            <strong className="home-metrics__value">Campo → gestão</strong>
            <span className="muted small">Mesma fonte da verdade</span>
          </div>
        </section>

        <section className="home-section" id="recursos" aria-labelledby="home-recursos-title">
          <h2 id="home-recursos-title" className="home-section__title">
            Recursos pensados para a operação real
          </h2>
          <p className="home-section__lead muted">
            Menos ruído entre grupos de mensagem e planilhas; mais estrutura para agir com segurança.
          </p>
          <div className="home-grid home-grid--features">
            <article className="home-feature-card">
              <IconSquircle tone="muted" size="lg">
                <IconOcorrencias />
              </IconSquircle>
              <h2>Ocorrências completas</h2>
              <p className="muted small">
                Título, setor, categoria, prioridade, descrição, fotos e coordenadas — tudo ligado ao
                caso para auditoria e decisão.
              </p>
            </article>
            <article className="home-feature-card">
              <IconSquircle tone="muted" size="lg">
                <IconEquipe />
              </IconSquircle>
              <h2>Equipe alinhada</h2>
              <p className="muted small">
                Cadastro e papéis distintos para quem produz, gerencia e executa no campo, com espaço
                para mensagens entre a equipe.
              </p>
            </article>
            <article className="home-feature-card">
              <IconSquircle tone="muted" size="lg">
                <IconDecisao />
              </IconSquircle>
              <h2>Mapa e relatórios</h2>
              <p className="muted small">
                Visualize onde os incidentes acontecem e consolide indicadores para priorizar investimento
                e tempo da equipe.
              </p>
            </article>
          </div>
        </section>

        <section className="home-section home-section--tint" id="como-funciona" aria-labelledby="home-steps-title">
          <h2 id="home-steps-title" className="home-section__title">
            Como funciona
          </h2>
          <p className="home-section__lead muted">Três passos para colocar a fazenda no mesmo ritmo da gestão.</p>
          <ol className="home-steps">
            {STEPS.map((s) => (
              <li key={s.n} className="home-step">
                <div className="home-step__num" aria-hidden>
                  {s.n}
                </div>
                <div>
                  <h3 className="home-step__title">{s.title}</h3>
                  <p className="home-step__text muted small">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-section" id="perfis" aria-labelledby="home-perfis-title">
          <h2 id="home-perfis-title" className="home-section__title">
            Um sistema, três pontos de vista
          </h2>
          <p className="home-section__lead muted">
            Cada perfil enxerga o que precisa — sem misturar responsabilidade com ruído de tela.
          </p>
          <div className="home-grid home-grid--roles">
            {ROLE_CARDS.map((r) => (
              <article key={r.id} className="home-role-card">
                <IconSquircle tone="accent" size="md">
                  {r.icon}
                </IconSquircle>
                <h3 className="home-role-card__title">{r.title}</h3>
                <p className="muted small">{r.text}</p>
              </article>
            ))}
          </div>
        </section>

        {!token ? (
          <section className="home-cta-panel" aria-labelledby="home-final-cta-title">
            <div className="home-cta-panel__inner">
              <div>
                <h2 id="home-final-cta-title" className="home-cta-panel__title">
                  Pronto para centralizar a operação?
                </h2>
                <p className="home-cta-panel__text muted">
                  Cadastre-se em minutos e experimente o fluxo de ocorrências com mapa e equipe.
                </p>
              </div>
              <div className="home-cta-panel__actions">
                <Link to="/cadastro" className="btn primary">
                  Criar conta
                </Link>
                <Link to="/login" className="btn ghost">
                  Já tenho conta
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <footer className="home-footer">
          <div className="home-footer__row">
            <span className="home-footer__brand">Agrolink</span>
            <nav className="home-footer__nav" aria-label="Links da página inicial">
              <a href="#recursos">Recursos</a>
              <a href="#como-funciona">Como funciona</a>
              <a href="#perfis">Perfis</a>
              {!token ? (
                <>
                  <Link to="/login">Entrar</Link>
                  <Link to="/cadastro">Cadastro</Link>
                </>
              ) : (
                <Link to="/dashboard">Dashboard</Link>
              )}
            </nav>
          </div>
          <p className="home-footer__note muted small">
            Ferramenta de apoio à gestão rural — organize ocorrências e equipe com clareza.
          </p>
        </footer>
      </div>
    </div>
  );
}
