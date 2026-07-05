export type MockOcc = {
  id: string;
  categoria: string;
  titulo: string;
  local: string;
  descricao: string;
  data: string;
  dataIso: string;
  status: 'aberta' | 'andamento' | 'critico' | 'resolvida';
  prioridade: 'alta' | 'urgente' | 'media' | 'baixa';
  responsavel: string | null;
  mediaClass: string;
  detalhe?: {
    tituloAlt?: string;
    gleba: string;
    gps: string;
    reportadoPor: string;
    tipoRegistro: string;
    responsavelAtual: string;
    descricaoLonga: string;
    timeline: Array<{ nome: string; acao: string; quando: string; comentario?: string }>;
  };
};

export const OCORRENCIAS_MOCK: MockOcc[] = [
  {
    id: 'OC-2024-001',
    categoria: 'PRAGA',
    titulo: 'Infestação de Lagarta-do-Cartucho',
    local: 'Talhão 12 — Setor Norte',
    descricao: 'Sintomas iniciais em área de aproximadamente 4 ha.',
    data: '12 Mai, 08:30',
    dataIso: '2024-05-12T08:30:00',
    status: 'aberta',
    prioridade: 'alta',
    responsavel: 'João Silva',
    mediaClass: 'occ-card__media--a',
  },
  {
    id: 'OC-2024-002',
    categoria: 'INFRAESTRUTURA',
    titulo: 'Quebra de irrigação no pivô 3',
    local: 'Setor B — Pivô Central',
    descricao: 'Vazamento identificado próximo ao reservatório.',
    data: '11 Mai, 14:20',
    dataIso: '2024-05-11T14:20:00',
    status: 'critico',
    prioridade: 'urgente',
    responsavel: null,
    mediaClass: 'occ-card__media--b',
  },
  {
    id: 'OC-2024-003',
    categoria: 'PRAGA',
    titulo: 'Mancha foliar em soja',
    local: 'Talhão 08',
    descricao: 'Acompanhamento técnico solicitado.',
    data: '10 Mai, 09:15',
    dataIso: '2024-05-10T09:15:00',
    status: 'andamento',
    prioridade: 'media',
    responsavel: 'Maria Souza',
    mediaClass: 'occ-card__media--c',
  },
  {
    id: 'OC-2024-004',
    categoria: 'SOLO',
    titulo: 'Análise de compactação',
    local: 'Área experimental Leste',
    descricao: 'Amostras coletadas para laboratório.',
    data: '09 Mai, 16:00',
    dataIso: '2024-05-09T16:00:00',
    status: 'andamento',
    prioridade: 'baixa',
    responsavel: 'Equipe campo',
    mediaClass: 'occ-card__media--d',
  },
  {
    id: 'OC-2024-005',
    categoria: 'INFRAESTRUTURA',
    titulo: 'Cerca danificada — linha norte',
    local: 'Divisa Talhão 03',
    descricao: 'Trecho com ~40 m comprometido.',
    data: '08 Mai, 11:45',
    dataIso: '2024-05-08T11:45:00',
    status: 'aberta',
    prioridade: 'media',
    responsavel: null,
    mediaClass: 'occ-card__media--e',
    detalhe: {
      tituloAlt: 'Rompimento de cerca — divisa sul com Fazenda Boa Vista',
      gleba: 'Pasto da Aroeira',
      gps: '-19,4821°, -44,1023°',
      reportadoPor: 'Ricardo Mendes',
      tipoRegistro: 'Infraestrutura',
      responsavelAtual: 'João Silveira',
      descricaoLonga:
        'Identificado rompimento de aproximadamente 12 m de cerca na divisa sul, com postes inclinados e arame solto. ' +
        'Área com movimentação de gado vizinho — necessário reparo urgente para evitar mistura de lotes. ' +
        'Equipe de manutenção foi acionada para avaliação presencial no próximo turno.',
      timeline: [
        {
          nome: 'João Silveira',
          acao: 'Assumiu a responsabilidade pela ocorrência',
          quando: 'Há 2 horas',
        },
        {
          nome: 'Ricardo Mendes',
          acao: 'Comentou no registro',
          quando: 'Há 5 horas',
          comentario: 'Poste 7 está com base comprometida — sugerir troca completa.',
        },
        {
          nome: 'Sistema',
          acao: 'Ocorrência criada a partir do app de campo',
          quando: '08 Mai, 11:45',
        },
      ],
    },
  },
  {
    id: 'OC-2024-006',
    categoria: 'PRAGA',
    titulo: 'Percevejo em estágio reprodutivo',
    local: 'Talhão 15',
    descricao: 'Monitoramento semanal em andamento.',
    data: '07 Mai, 07:00',
    dataIso: '2024-05-07T07:00:00',
    status: 'resolvida',
    prioridade: 'baixa',
    responsavel: 'João Silva',
    mediaClass: 'occ-card__media--f',
  },
];

export function getOcorrenciaById(id: string | undefined): MockOcc | undefined {
  if (!id) return undefined;
  return OCORRENCIAS_MOCK.find((o) => o.id === id);
}

function categoriaLegivel(cat: string): string {
  const c = cat.toLowerCase();
  if (c === 'praga') return 'Praga / Doença';
  if (c === 'infraestrutura') return 'Infraestrutura';
  if (c === 'solo') return 'Solo';
  return cat;
}

function timelinePadrao(o: MockOcc) {
  const linhas: Array<{ nome: string; acao: string; quando: string; comentario?: string }> = [
    {
      nome: o.responsavel ?? 'Coordenação',
      acao: o.responsavel ? 'Atualizou o acompanhamento da ocorrência' : 'Aguardando atribuição de responsável',
      quando: 'Há 3 horas',
    },
    {
      nome: 'Sistema',
      acao: 'Registro sincronizado com o servidor',
      quando: o.data,
    },
  ];
  return linhas;
}

export type OcorrenciaDetalheResolvido = {
  titulo: string;
  gleba: string;
  gps: string;
  reportadoPor: string;
  tipoRegistro: string;
  responsavelAtual: string;
  descricaoLonga: string;
  timeline: Array<{ nome: string; acao: string; quando: string; comentario?: string }>;
};

export function resolverDetalhe(o: MockOcc): OcorrenciaDetalheResolvido {
  const d = o.detalhe;
  return {
    titulo: d?.tituloAlt ?? o.titulo,
    gleba: d?.gleba ?? o.local,
    gps: d?.gps ?? '-19,5234°, -44,0891°',
    reportadoPor: d?.reportadoPor ?? 'Equipe campo',
    tipoRegistro: d?.tipoRegistro ?? categoriaLegivel(o.categoria),
    responsavelAtual: d?.responsavelAtual ?? o.responsavel ?? '—',
    descricaoLonga:
      d?.descricaoLonga ??
      `${o.descricao}\n\nA equipe técnica acompanha o caso conforme protocolo da fazenda.`,
    timeline: d?.timeline ?? timelinePadrao(o),
  };
}
