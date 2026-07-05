import type { PapelConta } from '../types/api';

const PAPEL_LABELS: Record<PapelConta, string> = {
  PRODUTOR: 'Produtor',
  GERENTE: 'Gerente',
  FUNCIONARIO_CAMPO: 'Funcionário de campo',
};

export function papelContaLabel(papel: PapelConta | string | null | undefined): string {
  if (!papel) return PAPEL_LABELS.GERENTE;
  return PAPEL_LABELS[papel as PapelConta] ?? String(papel).replaceAll('_', ' ');
}
