import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { IconSquircle } from './IconSquircle';
import { ThemeToggle } from './ThemeToggle';
import { IconAgrolink } from './icons/SystemIcons';
import { UserAvatar } from './UserAvatar';
import { papelContaLabel } from '../utils/papelConta';
import { HeaderNotificacoes } from './HeaderNotificacoes';
import { ConviteLoginPrompt } from './ConviteLoginPrompt';

const sidebarNavClass = ({ isActive }: { isActive: boolean }) =>
  `app-sidebar__link${isActive ? ' app-sidebar__link--active' : ''}`;

type Props = {
  children: ReactNode;
};

/**
 * Shell com sidebar + barra superior (telas autenticadas estilo dashboard).
 */
export function AppShell({ children }: Props) {
  const { logout, user } = useAuth();

  return (
    <div className="map-page">
      <aside className="app-sidebar" aria-label="Menu da aplicação">
        <div className="app-sidebar__logo">
          <IconSquircle tone="accent" size="xs">
            <IconAgrolink />
          </IconSquircle>
          <span className="app-sidebar__brand-title">AGROLINK</span>
        </div>
        <nav className="app-sidebar__nav">
          <NavLink to="/dashboard" className={sidebarNavClass} end>
            Dashboard
          </NavLink>
          {user?.papel === 'GERENTE' ? (
            <NavLink to="/fazenda" className={sidebarNavClass}>
              Minha fazenda
            </NavLink>
          ) : null}
          <NavLink to="/ocorrencias" className={sidebarNavClass}>
            Ocorrências
          </NavLink>
          <NavLink to="/mapa" className={sidebarNavClass}>
            Mapa
          </NavLink>
          <NavLink to="/registrar" className={sidebarNavClass}>
            Registrar
          </NavLink>
          <NavLink to="/mensagens" className={sidebarNavClass}>
            Mensagens
          </NavLink>
          <NavLink to="/equipe" className={sidebarNavClass}>
            Equipe
          </NavLink>
          <NavLink to="/relatorios" className={sidebarNavClass}>
            Relatórios
          </NavLink>
        </nav>
        <div className="app-sidebar__footer">
          <div className="app-sidebar__footer-actions">
            <button type="button" className="app-sidebar__logout" onClick={() => logout()}>
              Sair
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="map-page__main">
        <div className="app-shell-topbar" role="region" aria-label="Conta e notificações">
          <div className="app-shell-topbar__actions">
            {user ? (
              <div className="app-shell-account" title={`${user.nome} · ${papelContaLabel(user.papel)}`}>
                <span className="app-shell-account__name">{user.nome}</span>
                <span className="app-shell-account__dot" aria-hidden>
                  ·
                </span>
                <span className="app-shell-account__role">{papelContaLabel(user.papel)}</span>
              </div>
            ) : null}
            <NavLink
              to="/perfil"
              className={({ isActive }) => `app-shell-profile-btn${isActive ? ' is-active' : ''}`}
              title="Meu perfil"
              aria-label="Meu perfil"
            >
              <UserAvatar nome={user?.nome ?? 'Conta'} fotoUrl={user?.fotoUrl} />
            </NavLink>
            <HeaderNotificacoes />
          </div>
        </div>
        <div className="app-shell-content">{children}</div>
      </div>
      <ConviteLoginPrompt />
    </div>
  );
}
