import { useTheme } from '../theme/ThemeContext';
import { IconSquircle } from './IconSquircle';
import { IconMoon, IconSun } from './icons/SystemIcons';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
    >
      <IconSquircle tone="muted" size="sm">
        {isDark ? <IconSun /> : <IconMoon />}
      </IconSquircle>
    </button>
  );
}
