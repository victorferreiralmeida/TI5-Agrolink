import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconSquircle } from './IconSquircle';
import { IconAgrolink } from './icons/SystemIcons';
import { ThemeToggle } from './ThemeToggle';
import { papelContaLabel } from '../utils/papelConta';
import { HeaderNotificacoes } from './HeaderNotificacoes';
import { UserAvatar } from './UserAvatar';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'site-nav-link is-active' : 'site-nav-link';

export function AppHeader() {
  const { token, user, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <NavLink to="/" className="site-header-brand" end>
          <IconSquircle tone="accent" size="sm">
            <IconAgrolink />
          </IconSquircle>
          <span className="brand-title">Agrolink</span>
        </NavLink>

        <nav className="site-header-nav" aria-label="Navegação principal">
          <NavLink to="/" className={navClass} end>
            Início
          </NavLink>
          {token ? (
            <>
              <NavLink to="/dashboard" className={navClass}>
                Dashboard
              </NavLink>
              <NavLink to="/ocorrencias" className={navClass}>
                Ocorrências
              </NavLink>
              <NavLink to="/mapa" className={navClass}>
                Mapa
              </NavLink>
              <NavLink to="/registrar" className={navClass}>
                Registrar
              </NavLink>
              <NavLink to="/mensagens" className={navClass}>
                Mensagens
              </NavLink>
              <NavLink to="/equipe" className={navClass}>
                Equipe
              </NavLink>
              <NavLink to="/relatorios" className={navClass}>
                Relatórios
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>
                Entrar
              </NavLink>
              <NavLink to="/cadastro" className={navClass}>
                Cadastro
              </NavLink>
            </>
          )}
        </nav>

        <div className="site-header-actions">
          {token ? <HeaderNotificacoes /> : null}
          {token && user ? (
            <div className="header-user-pill" title={`${user.nome} · ${papelContaLabel(user.papel)}`}>
              <UserAvatar nome={user.nome} fotoUrl={user.fotoUrl} className="header-user-pill__avatar" />
              <span className="header-user-pill__dot" aria-hidden />
              <span className="header-user-pill__meta">
                <span className="header-user-pill__role muted small">{papelContaLabel(user.papel)}</span>
                <span className="header-user-pill__name">{user.nome.split(/\s+/)[0] ?? user.nome}</span>
              </span>
            </div>
          ) : null}
          {token ? (
            <button type="button" className="btn ghost btn-sm" onClick={logout}>
              Sair
            </button>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
