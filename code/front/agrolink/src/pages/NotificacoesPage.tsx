import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';

type Item = {
  id: string;
  tag: string;
  tagTone: 'danger' | 'ok' | 'muted';
  icon: 'alert' | 'user' | 'chat' | 'sync' | 'wrench';
  titulo: string;
  tempo: string;
  unread?: boolean;
  unreadTone?: 'danger' | 'ok';
};

const ITENS: Item[] = [
  {
    id: '1',
    tag: 'Nova ocorrência',
    tagTone: 'danger',
    icon: 'alert',
    titulo: 'Nova ocorrência: praga detectada no Talhão 04',
    tempo: '5 min atrás',
    unread: true,
    unreadTone: 'danger',
  },
  {
    id: '2',
    tag: 'Atribuída',
    tagTone: 'ok',
    icon: 'user',
    titulo: 'Ocorrência #442 atribuída a você',
    tempo: '45 min atrás',
    unread: true,
    unreadTone: 'ok',
  },
  {
    id: '3',
    tag: 'Comentário',
    tagTone: 'ok',
    icon: 'chat',
    titulo: 'Novo comentário de Carlos na análise de solo',
    tempo: '2 horas atrás',
    unread: true,
    unreadTone: 'ok',
  },
  {
    id: '4',
    tag: 'Status',
    tagTone: 'muted',
    icon: 'sync',
    titulo: 'Status atualizado: colheita Setor Sul concluída',
    tempo: '5 horas atrás',
  },
  {
    id: '5',
    tag: 'Manutenção',
    tagTone: 'muted',
    icon: 'wrench',
    titulo: 'Lembrete: manutenção preventiva do trator JD-42',
    tempo: 'Ontem',
  },
];

function NotifIcon({ kind }: { kind: Item['icon'] }) {
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
          <path d="M4 12a8 8 0 0 1 8-8V2l3 3-3 3V6a6 6 0 0 0-6 6M20 12a8 8 0 0 1-8 8v2l-3-3 3-3v2a6 6 0 0 0 6-6" strokeLinecap="round" />
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

/**
 * Central de notificações (wireframe): apenas navegação e UI estática.
 */
export function NotificacoesPage() {
  return (
    <AppShell>
      <div className="notif-page">
        <article className="notif-card">
          <header className="notif-card__brand">
            <div className="notif-card__brand-left">
              <span className="notif-card__logo" aria-hidden />
              <span className="notif-card__name">AGROLINK</span>
            </div>
            <Link to="/dashboard" className="notif-card__close" aria-label="Fechar e voltar ao dashboard">
              ×
            </Link>
          </header>

          <div className="notif-card__head">
            <h1 className="notif-card__title">Notificações</h1>
            <button type="button" className="notif-card__markall" disabled title="Em breve">
              ✓✓ Marcar todas como lidas
            </button>
          </div>

          <div className="notif-card__context">
            <span className="notif-card__context-arrow" aria-hidden>
              ›
            </span>
            <div>
              <p className="notif-card__context-label muted small">Área atual</p>
              <p className="notif-card__context-value">Setor de grãos / Talhões 01–10</p>
            </div>
          </div>

          <ul className="notif-list">
            {ITENS.map((item) => (
              <li key={item.id} className="notif-row">
                <NotifIcon kind={item.icon} />
                <div className="notif-row__body">
                  <span className={`notif-row__tag notif-row__tag--${item.tagTone}`}>{item.tag}</span>
                  <p className="notif-row__titulo">{item.titulo}</p>
                  <p className="notif-row__tempo muted small">{item.tempo}</p>
                </div>
                {item.unread ? (
                  <span
                    className={`notif-row__dot notif-row__dot--${item.unreadTone === 'danger' ? 'danger' : 'ok'}`}
                    aria-label="Não lida"
                  />
                ) : null}
              </li>
            ))}
          </ul>

          <Link to="/ocorrencias" className="notif-card__history muted">
            Ver todo o histórico da fazenda
          </Link>
        </article>
      </div>
    </AppShell>
  );
}
