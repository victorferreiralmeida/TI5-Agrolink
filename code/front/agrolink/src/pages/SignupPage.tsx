import { FormEvent, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PasswordInput } from '../components/PasswordInput';
import { IconSquircle } from '../components/IconSquircle';
import {
  IconAgrolink,
  IconCheck,
  IconFuncionario,
  IconGerente,
  IconTractor,
} from '../components/icons/SystemIcons';
import { formatNomeBlur, maskNomeDigitando } from '../utils/maskNome';
import {
  analyzePasswordStrength,
  isPasswordStrengthWeak,
  passwordStrengthLabel,
} from '../utils/passwordStrength';
import type { PapelConta } from '../types/api';

type PapelOption = {
  value: PapelConta;
  label: string;
  description: string;
  icon: ReactNode;
};

const PAPEIS: PapelOption[] = [
  {
    value: 'PRODUTOR',
    label: 'Produtor',
    description: 'Visão da propriedade, operações e indicadores consolidados.',
    icon: <IconTractor />,
  },
  {
    value: 'GERENTE',
    label: 'Gerente',
    description: 'Coordena equipe, prioridades e acompanhamento das ocorrências.',
    icon: <IconGerente />,
  },
  {
    value: 'FUNCIONARIO_CAMPO',
    label: 'Funcionário de campo',
    description: 'Registro de incidentes e atualizações direto do dia a dia no campo.',
    icon: <IconFuncionario />,
  },
];

export function SignupPage() {
  const { register, token } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [papel, setPapel] = useState<PapelConta>('GERENTE');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const passwordRequirements = [
    { id: 'len', label: 'Mínimo de 8 caracteres', passed: hasMinLength },
    { id: 'upper', label: 'Pelo menos 1 letra maiúscula', passed: hasUpper },
    { id: 'lower', label: 'Pelo menos 1 letra minúscula', passed: hasLower },
    { id: 'digit', label: 'Pelo menos 1 número', passed: hasDigit },
    { id: 'special', label: 'Pelo menos 1 caractere especial', passed: hasSpecial },
  ];
  const hasAllPasswordRequirements = passwordRequirements.every((rule) => rule.passed);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!hasAllPasswordRequirements || isPasswordStrengthWeak(password)) {
      setError(
        'Senha insuficiente. Atenda aos critérios: 8+ caracteres, letra maiúscula, letra minúscula, número e caractere especial.',
      );
      return;
    }
    setLoading(true);
    try {
      const auth = await register({
        nome: formatNomeBlur(nome).trim(),
        email: email.trim(),
        password,
        papel,
      });
      navigate(auth.usuario.papel === 'GERENTE' ? '/fazenda' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  }

  const passwordStrength = analyzePasswordStrength(password);
  const submitDisabled = loading || (password.length > 0 && (!hasAllPasswordRequirements || isPasswordStrengthWeak(password)));

  return (
    <div className="page-bg-auth bg-auth-gradient">
      <div className="auth-layout">
        <div className="auth-card auth-card--wide auth-card--landing-like">
          <Link to="/" className="auth-back-home">
            ← Voltar para a landing
          </Link>
          <div className="brand">
            <IconSquircle tone="accent" size="md">
              <IconAgrolink />
            </IconSquircle>
            <div className="brand__text">
              <h1>Agrolink</h1>
              <p className="muted">Novo usuário</p>
            </div>
          </div>
          <h2>Cadastro</h2>
          <form className="stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Nome</span>
              <input
                type="text"
                name="nome"
                autoComplete="name"
                inputMode="text"
                value={nome}
                onChange={(e) => setNome(maskNomeDigitando(e.target.value))}
                onBlur={() => setNome((n) => formatNomeBlur(n))}
                required
                placeholder="Ex.: João Silva"
              />
            </label>
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
              <label htmlFor="signup-password">
                <span>Senha</span>
              </label>
              <PasswordInput
                id="signup-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Combine letras, números e símbolos"
                aria-describedby="password-strength-meter password-rules"
              />
              <div
                id="password-strength-meter"
                className="password-strength"
                aria-live="polite"
              >
                <div className="password-strength__row">
                  <p className="password-strength__hint muted small">Força da senha</p>
                  {password.length === 0 ? (
                    <span className="muted small">Digite para avaliar</span>
                  ) : (
                    <span
                      className={`password-strength__badge password-strength__badge--${passwordStrength.level}`}
                    >
                      {passwordStrengthLabel(passwordStrength.level)}
                    </span>
                  )}
                </div>
                <div
                  className="password-strength__track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={passwordStrength.score}
                  aria-label="Nível de força da senha"
                >
                  <div
                    className={`password-strength__fill password-strength__fill--${passwordStrength.level}`}
                    style={{ width: `${passwordStrength.score}%` }}
                  />
                </div>
                <div id="password-rules" className="password-rules">
                  <p className="password-rules__title muted small">
                    Para uma senha forte, use:
                  </p>
                  <ul className="password-rules__list">
                    {passwordRequirements.map((rule) => (
                      <li
                        key={rule.id}
                        className={`password-rules__item ${rule.passed ? 'password-rules__item--ok' : 'password-rules__item--pending'}`}
                      >
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="field field--block">
              <span className="step-label">
                <span className="step-label__num" aria-hidden>
                  3
                </span>
                Perfil de acesso
              </span>
              <div className="role-card-grid" role="group" aria-label="Perfil de acesso">
                {PAPEIS.map((p) => {
                  const selected = papel === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      className={`role-card${selected ? ' role-card--selected' : ''}`}
                      onClick={() => setPapel(p.value)}
                      aria-pressed={selected}
                    >
                      {selected ? (
                        <span className="role-card__check" aria-hidden>
                          <IconCheck />
                        </span>
                      ) : null}
                      <IconSquircle tone={selected ? 'accent' : 'muted'} size="md">
                        {p.icon}
                      </IconSquircle>
                      <span className="role-card__title">{p.label}</span>
                      <span className="role-card__desc muted small">{p.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? <p className="error-text">{error}</p> : null}
            <button type="submit" className="btn primary" disabled={submitDisabled}>
              {loading ? 'Criando…' : 'Criar conta'}
            </button>
          </form>
          <p className="muted small center">
            Já tem uma conta? <Link to="/login">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
