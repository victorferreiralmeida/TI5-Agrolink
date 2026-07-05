export type PapelConta = 'PRODUTOR' | 'GERENTE' | 'FUNCIONARIO_CAMPO';

export type UserSummary = {
  id: number;
  nome: string;
  email: string;
  papel: PapelConta;
  telefone: string | null;
  fotoUrl: string | null;
  /** false até gerente cadastrar fazenda ou membro aceitar convite */
  temFazenda: boolean;
};

export type AuthResponse = {
  token: string;
  usuario: UserSummary;
};

export type Ocorrencia = {
  id: number;
  titulo: string;
  descricao: string;
  status: string;
  prioridade: string;
  criadoEm: string;
};

export type HealthResponse = {
  status: string;
  aplicacao: string;
};
