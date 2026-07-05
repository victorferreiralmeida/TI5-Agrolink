export type PasswordStrengthLevel = 'fraca' | 'media' | 'forte';

const LABEL: Record<PasswordStrengthLevel, string> = {
  fraca: 'Fraca',
  media: 'Média',
  forte: 'Forte',
};

export function passwordStrengthLabel(level: PasswordStrengthLevel): string {
  return LABEL[level];
}

/**
 * Considera comprimento, maiúsculas, minúsculas, números e símbolos.
 * Retorna nível e pontuação 0–100 para a barra.
 */
export function analyzePasswordStrength(password: string): {
  level: PasswordStrengthLevel;
  score: number;
} {
  if (!password.length) {
    return { level: 'fraca', score: 0 };
  }

  const len = password.length;
  let score = 0;

  if (len >= 14) score += 30;
  else if (len >= 10) score += 26;
  else if (len >= 8) score += 20;
  else if (len >= 6) score += 12;
  else score += Math.round(len * 1.8);

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (hasLower) score += 17.5;
  if (hasUpper) score += 17.5;
  if (hasDigit) score += 17.5;
  if (hasSpecial) score += 17.5;

  score = Math.min(100, Math.round(score));

  if (len < 6) {
    return { level: 'fraca', score: Math.min(score, 40) };
  }

  let level: PasswordStrengthLevel;
  if (score < 48) level = 'fraca';
  else if (score < 78) level = 'media';
  else level = 'forte';

  return { level, score };
}

export function isPasswordStrengthWeak(password: string): boolean {
  return analyzePasswordStrength(password).level === 'fraca';
}
