import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type RelatorioPdfTableRow = {
  id: string;
  data: string;
  tipo: string;
  area: string;
  prioridade: string;
  status: string;
};

export type RelatorioPdfInput = {
  geradoEm: string;
  periodoLabel: string;
  intervaloDatas: string;
  tipoLabel: string;
  areaLabel: string;
  prioridadeLabel: string;
  statusLabel: string;
  totalOcorrencias: number;
  comparativoPercent: number;
  mediaResolucaoValor: string;
  criticasCount: number;
  kpiCriticasSubtexto: string;
  resolvidas: number;
  abertas: number;
  pctResolvidas: string;
  pctAbertas: string;
  areaBars: { label: string; count: number }[];
  linhasTabela: RelatorioPdfTableRow[];
  /** PNG data URL (diagrama da fazenda, setores e ocorrências); omitido se não houver dados para desenhar. */
  mapaPngDataUrl?: string | null;
};

const MARGIN = 14;
const PAGE_BOTTOM = 280;

const COLOR_PRIMARY: [number, number, number] = [31, 107, 58];
const COLOR_DANGER: [number, number, number] = [194, 65, 65];
const COLOR_TEXT: [number, number, number] = [33, 37, 41];
const COLOR_MUTED: [number, number, number] = [100, 100, 100];
const COLOR_BORDER: [number, number, number] = [210, 220, 210];

function pageInnerWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth() - 2 * MARGIN;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_BOTTOM) {
    doc.addPage();
    return MARGIN + 6;
  }
  return y;
}

function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  doc.setDrawColor(...COLOR_BORDER);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');
}

function drawPieSlice(
  doc: jsPDF,
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
  rgb: [number, number, number],
): void {
  if (endDeg <= startDeg) return;
  doc.setFillColor(...rgb);
  const startRad = ((startDeg - 90) * Math.PI) / 180;
  const endRad = ((endDeg - 90) * Math.PI) / 180;
  const segments = Math.max(8, Math.ceil((endDeg - startDeg) / 4));
  const step = (endRad - startRad) / segments;
  let angle = startRad;
  for (let i = 0; i < segments; i++) {
    const x1 = cx + radius * Math.cos(angle);
    const y1 = cy + radius * Math.sin(angle);
    const x2 = cx + radius * Math.cos(angle + step);
    const y2 = cy + radius * Math.sin(angle + step);
    doc.triangle(cx, cy, x1, y1, x2, y2, 'F');
    angle += step;
  }
}

function drawDonut(
  doc: jsPDF,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  resolvidoPct: number,
  abertoPct: number,
  total: number,
): void {
  let start = 0;
  if (resolvidoPct > 0) {
    drawPieSlice(doc, cx, cy, outerR, start, start + resolvidoPct * 3.6, COLOR_PRIMARY);
    start += resolvidoPct * 3.6;
  }
  if (abertoPct > 0) {
    drawPieSlice(doc, cx, cy, outerR, start, start + abertoPct * 3.6, COLOR_DANGER);
  }
  if (resolvidoPct <= 0 && abertoPct <= 0) {
    doc.setFillColor(...COLOR_BORDER);
    doc.circle(cx, cy, outerR, 'F');
  }
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, innerR, 'F');
  doc.setTextColor(...COLOR_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(String(total), cx, cy - 1, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Total', cx, cy + 4.5, { align: 'center' });
}

function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return `${label.slice(0, maxLen - 1)}…`;
}

function drawKpiRow(doc: jsPDF, y: number, data: RelatorioPdfInput): number {
  const innerW = pageInnerWidth(doc);
  const gap = 3;
  const cardW = (innerW - gap * 2) / 3;
  const cardH = 30;
  y = ensureSpace(doc, y, cardH + 4);

  const cards: {
    icon: string;
    label: string;
    value: string;
    sub: string;
    subRgb: [number, number, number];
  }[] = [
    {
      icon: 'DOC',
      label: 'Total de ocorrências',
      value: String(data.totalOcorrencias),
      sub: `${data.comparativoPercent >= 0 ? '↗' : '↘'} ${Math.abs(data.comparativoPercent).toFixed(1)}% no período comparável`,
      subRgb: data.comparativoPercent >= 0 ? COLOR_PRIMARY : COLOR_DANGER,
    },
    {
      icon: 'TEM',
      label: 'Média de resolução',
      value: data.mediaResolucaoValor,
      sub: 'Baseado nas ocorrências resolvidas do período',
      subRgb: COLOR_DANGER,
    },
    {
      icon: '!',
      label: 'Ocorrências críticas',
      value: String(data.criticasCount),
      sub: data.kpiCriticasSubtexto,
      subRgb: data.kpiCriticasSubtexto.startsWith('Sem') ? COLOR_PRIMARY : COLOR_PRIMARY,
    },
  ];

  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardW + gap);
    drawCard(doc, x, y, cardW, cardH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(card.icon, x + 3.5, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const labelLines = doc.splitTextToSize(card.label, cardW - 8);
    doc.text(labelLines, x + 3.5, y + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(card.value, x + 3.5, y + 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...card.subRgb);
    const subLines = doc.splitTextToSize(card.sub, cardW - 7);
    doc.text(subLines, x + 3.5, y + 26);
  });

  return y + cardH + 6;
}

function drawChartsRow(doc: jsPDF, y: number, data: RelatorioPdfInput): number {
  const innerW = pageInnerWidth(doc);
  const gap = 4;
  const boxW = (innerW - gap) / 2;
  const boxH = 62;
  y = ensureSpace(doc, y, boxH + 4);

  const total = Math.max(1, data.totalOcorrencias);
  const resolvidoPct = (data.resolvidas / total) * 100;
  const abertoPct = Math.max(0, 100 - resolvidoPct);

  const boxes = [
    { x: MARGIN, title: 'Distribuição por status' },
    { x: MARGIN + boxW + gap, title: 'Ocorrências por área' },
  ];

  for (const box of boxes) {
    drawCard(doc, box.x, y, boxW, boxH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(box.title, box.x + 4, y + 7);
  }

  const donutCx = boxes[0].x + 22;
  const donutCy = y + 36;
  drawDonut(doc, donutCx, donutCy, 16, 10, resolvidoPct, abertoPct, data.totalOcorrencias);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_TEXT);
  let legendY = y + 24;
  const legendX = boxes[0].x + 42;
  const legendItems = [
    { rgb: COLOR_PRIMARY, text: `Resolvido (${data.resolvidas}) (${data.pctResolvidas})` },
    { rgb: COLOR_DANGER, text: `Aberto (${data.abertas}) (${data.pctAbertas})` },
  ];
  for (const item of legendItems) {
    doc.setFillColor(...item.rgb);
    doc.rect(legendX, legendY - 2.5, 2.5, 2.5, 'F');
    const lines = doc.splitTextToSize(item.text, boxW - 46);
    doc.text(lines, legendX + 4, legendY);
    legendY += (Array.isArray(lines) ? lines.length : 1) * 4.5 + 1;
  }

  const barsX = boxes[1].x + 5;
  const barsW = boxW - 10;
  const barsBaseY = y + boxH - 14;
  const maxBarH = 36;

  if (data.areaBars.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('Sem dados para exibir.', barsX + barsW / 2, y + 36, { align: 'center' });
  } else {
    const maxCount = Math.max(1, ...data.areaBars.map((b) => b.count));
    const n = data.areaBars.length;
    const colW = barsW / n;
    data.areaBars.forEach((bar, i) => {
      const cx = barsX + i * colW + colW / 2;
      const barH = Math.max(2, (bar.count / maxCount) * maxBarH);
      const barTop = barsBaseY - barH;
      doc.setFillColor(...COLOR_PRIMARY);
      doc.rect(cx - colW * 0.22, barTop, colW * 0.44, barH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(String(bar.count), cx, barTop - 2, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...COLOR_MUTED);
      const lbl = truncateLabel(bar.label, 12);
      const lblLines = doc.splitTextToSize(lbl, colW - 1);
      doc.text(lblLines, cx, barsBaseY + 3, { align: 'center' });
    });
  }

  return y + boxH + 6;
}

/**
 * Gera um PDF estruturado com filtros, indicadores visuais e tabela de ocorrências (sem depender da impressão do navegador).
 */
export function downloadRelatorioOcorrenciasPdf(data: RelatorioPdfInput): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('AGROLINK', MARGIN, y);
  y += 9;

  doc.setTextColor(...COLOR_TEXT);
  doc.setFontSize(12);
  doc.text('Relatório operacional de ocorrências', MARGIN, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`Emitido em ${data.geradoEm}`, MARGIN, y);
  y += 10;

  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.35);
  doc.line(MARGIN, y, doc.internal.pageSize.getWidth() - MARGIN, y);
  y += 7;

  doc.setTextColor(...COLOR_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Filtros aplicados', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  const filtros: [string, string][] = [
    ['Período base', data.periodoLabel],
    ['Intervalo de datas', data.intervaloDatas],
    ['Tipo', data.tipoLabel],
    ['Área', data.areaLabel],
    ['Prioridade', data.prioridadeLabel],
    ['Status', data.statusLabel],
  ];

  for (const [rotulo, valor] of filtros) {
    y = ensureSpace(doc, y, 6);
    doc.setFont('helvetica', 'bold');
    doc.text(`${rotulo}:`, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(valor, doc.internal.pageSize.getWidth() - MARGIN * 2 - 38);
    doc.text(lines, MARGIN + 38, y);
    y += Math.max(5, (Array.isArray(lines) ? lines.length : 1) * 4.2);
  }

  y += 4;
  y = ensureSpace(doc, y, 40);
  doc.setDrawColor(...COLOR_BORDER);
  doc.line(MARGIN, y, doc.internal.pageSize.getWidth() - MARGIN, y);
  y += 8;

  y = drawKpiRow(doc, y, data);
  y = drawChartsRow(doc, y, data);

  if (data.mapaPngDataUrl) {
    y += 2;
    y = ensureSpace(doc, y, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_TEXT);
    doc.text('Mapa do recorte', MARGIN, y);
    y += 6;

    const pageInnerW = pageInnerWidth(doc);
    const imgProps = doc.getImageProperties(data.mapaPngDataUrl);
    const sideMm = Math.min(pageInnerW, 138);
    const imgW = sideMm;
    const imgH = (imgProps.height / imgProps.width) * imgW;
    y = ensureSpace(doc, y, imgH + 8);
    const pageW = doc.internal.pageSize.getWidth();
    const imgX = (pageW - imgW) / 2;
    doc.addImage(data.mapaPngDataUrl, 'PNG', imgX, y, imgW, imgH);
    y += imgH + 8;
  }

  y = ensureSpace(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Lista de ocorrências', MARGIN, y);
  y += 4;

  const body =
    data.linhasTabela.length === 0
      ? [['—', '—', 'Nenhuma ocorrência', '—', '—', '—']]
      : data.linhasTabela.map((r) => [r.id, r.data, r.tipo, r.area, r.prioridade, r.status]);

  autoTable(doc, {
    startY: y,
    head: [['ID', 'Data', 'Tipo', 'Área', 'Prioridade', 'Status']],
    body,
    styles: { fontSize: 8, cellPadding: 1.8, textColor: [40, 40, 40] },
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [248, 252, 249] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 24 },
      4: { cellWidth: 22 },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 14 },
    showHead: 'everyPage',
    tableLineColor: [220, 228, 220],
    tableLineWidth: 0.1,
  });

  const totalPages = doc.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`AGROLINK — Página ${i} de ${totalPages}`, MARGIN, pageH - 8);
  }

  const safeName = `relatorio-ocorrencias-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(safeName);
}
