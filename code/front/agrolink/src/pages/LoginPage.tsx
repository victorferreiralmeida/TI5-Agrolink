import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fetchMinhaFazenda } from '../api/fazendaApi';
import { PasswordInput } from '../components/PasswordInput';
import { IconSquircle } from '../components/IconSquircle';
import { IconAgrolink } from '../components/icons/SystemIcons';

export function LoginPage() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = await login(email.trim(), password);
      if (auth.usuario.papel === 'GERENTE') {
        const fazenda = await fetchMinhaFazenda(auth.token);
        navigate(fazenda ? '/dashboard' : '/fazenda', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-bg-auth bg-auth-gradient">
      <div className="auth-layout">
        <div className="auth-card auth-card--landing-like">
          <Link to="/" className="auth-back-home">
            ← Voltar para a landing
          </Link>
          <div className="brand">
            <IconSquircle tone="accent" size="md">
              <IconAgrolink />
            </IconSquircle>
            <div className="brand__text">
              <h1>Agrolink</h1>
              <p className="muted">Monitoramento e gestão rural</p>
            </div>
          </div>
          <h2>Entrar</h2>
          <p className="muted small">Use o e-mail e a senha do seu cadastro.</p>
          <form className="stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>E-mail</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="voce@fazenda.com"
              />
            </label>
            <div className="field">
              <label htmlFor="login-password">
                <span>Senha</span>
              </label>
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            {error ? <p className="error-text">{error}</p> : null}
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
          <p className="muted small center">
            Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
