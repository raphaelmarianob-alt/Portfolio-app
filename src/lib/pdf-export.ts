import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Interfaces ──────────────────────────────────────────────

interface AtivoRelatorio {
  id: number;
  ticker: string;
  tipo: string;
  valor_rs: number;
  peso: number;
  movimentacao: string | null;
}

interface RelatorioData {
  id: number;
  nome_cliente: string;
  data: string;
  objetivo: string;
  pct_pl_acoes: number;
  valor_total: number;
  status: string;
  created_at: string;
}

interface ResearchAtivo {
  ticker: string;
  nome_empresa: string;
  setor: string;
  roe: number | null;
  p_vpa: number | null;
  p_l: number | null;
  ev_ebitda: number | null;
  div_yield: number | null;
  classificacao: string;
  recomendacao: string;
  analise_texto: string;
}

// ── Helpers ─────────────────────────────────────────────────

const fmt = (v: number | null | undefined) =>
  v !== null && v !== undefined ? v.toFixed(2) : "—";

const fmtCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const MESES = [
  "jan.", "fev.", "mar.", "abr.", "mai.", "jun.",
  "jul.", "ago.", "set.", "out.", "nov.", "dez.",
];

function formatDateBR(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

// ── Dark palette (RGB) ──────────────────────────────────────

type RGB = [number, number, number];

const C_BG:      RGB = [6, 13, 26];       // #060d1a  — page background
const C_CARD:    RGB = [13, 27, 42];       // #0d1b2a  — cards / alt row dark
const C_ZEBRA:   RGB = [26, 39, 68];       // #1a2744  — zebra stripe / header
const C_TEXT:    RGB = [240, 244, 248];     // #f0f4f8  — primary text
const C_SEC:     RGB = [143, 163, 188];     // #8fa3bc  — secondary text
const C_MUTED:   RGB = [74, 96, 128];       // #4a6080  — muted / footer
const C_ACCENT:  RGB = [74, 144, 217];      // #4a90d9  — accent blue
const C_SILVER:  RGB = [200, 214, 229];     // #c8d6e5  — silver / table header text

// Horizontal line between rows: very subtle blue
const C_ROW_LINE: RGB = [74, 144, 217];     // drawn at low opacity via workaround

// Badge colors — dark bg + colored border + colored text
const MOV_BADGE: Record<string, { bg: RGB; text: RGB; border: RGB }> = {
  sair:     { bg: [40, 15, 18],  text: [255, 107, 107], border: [220, 53, 69] },
  reduzir:  { bg: [35, 30, 10],  text: [255, 193, 7],   border: [234, 165, 12] },
  manter:   { bg: [20, 25, 35],  text: [143, 163, 188],  border: [74, 96, 128] },
  aumentar: { bg: [10, 35, 20],  text: [92, 214, 92],   border: [40, 167, 69] },
  entrar:   { bg: [10, 25, 45],  text: [77, 166, 255],  border: [37, 99, 235] },
};

// Movimentações table — header gradient colors (dark)
const MOV_COL: Record<string, { top: RGB; main: RGB; text: RGB }> = {
  sair:     { top: [120, 30, 35],  main: [60, 15, 20],   text: [255, 107, 107] },
  reduzir:  { top: [30, 60, 120],  main: [15, 30, 60],   text: [77, 166, 255] },
  manter:   { top: [30, 50, 90],   main: [15, 25, 50],   text: [143, 163, 188] },
  aumentar: { top: [20, 80, 45],   main: [10, 40, 22],   text: [92, 214, 92] },
  entrar:   { top: [15, 50, 110],  main: [8, 25, 55],    text: [77, 166, 255] },
};

// ── Logo loader (SVG → PNG via canvas) ──────────────────────

interface LogoData {
  base64: string;
  aspectRatio: number;
}

async function loadLogoBase64(): Promise<LogoData | null> {
  try {
    const res = await fetch("/logo.svg");
    const svgText = await res.text();
    const img = new Image();
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      img.onload = () => {
        const scale = 4;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve({ base64: canvas.toDataURL("image/png"), aspectRatio: img.naturalWidth / img.naturalHeight });
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  } catch {
    return null;
  }
}

// Watermark logo at 3% opacity (white version via canvas manipulation)
function makeWatermarkLogo(logoData: LogoData): string | null {
  try {
    const img = document.createElement("img");
    img.src = logoData.base64;
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = Math.round(400 / logoData.aspectRatio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.globalAlpha = 0.03;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// ── Main export ─────────────────────────────────────────────

export async function exportRelatorioPDF(
  relatorio: RelatorioData,
  ativosAtuais: AtivoRelatorio[],
  ativosSugeridos: AtivoRelatorio[],
  researchMap: Map<string, ResearchAtivo>
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();   // 210
  const H = doc.internal.pageSize.getHeight();  // 297
  const M = 14;
  const CW = W - M * 2;
  let y = M;

  const logoData = await loadLogoBase64();
  const watermark = logoData ? makeWatermarkLogo(logoData) : null;

  // Logo fit helper — max 56mm wide, preserve aspect ratio
  const ar = logoData?.aspectRatio ?? 2.5;
  const fitLogo = (maxH: number) => {
    let h = maxH;
    let w = h * ar;
    if (w > 56) { w = 56; h = w / ar; }
    return { w, h };
  };
  const logo1 = fitLogo(11);  // page 1 (32px)
  const logo2 = fitLogo(11);  // pages 2+

  const HEADER_H1 = 18;  // ~50px
  const HEADER_H2 = 18;
  const LH_BODY = 5.3;
  const LOGO_PAD = 3.5;

  // ── Fill page background ──────────────────────────────────

  const fillPageBg = () => {
    doc.setFillColor(...C_BG);
    doc.rect(0, 0, W, H, "F");
  };

  // ── Draw watermark centered on page ───────────────────────

  const drawWatermark = () => {
    if (!watermark) return;
    const wmW = 80;
    const wmH = wmW / ar;
    doc.addImage(watermark, "PNG", (W - wmW) / 2, (H - wmH) / 2, wmW, wmH, undefined, "FAST");
  };

  // ── Accent gradient line below header ─────────────────────

  const drawAccentLine = (atY: number) => {
    const steps = 40;
    const stepW = W / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(C_ACCENT[0] * (1 - t * 0.6));
      const g = Math.round(C_ACCENT[1] * (1 - t * 0.4));
      const b = Math.round(C_ACCENT[2] * (1 - t * 0.2));
      doc.setFillColor(r, g, b);
      doc.rect(i * stepW, atY, stepW + 0.5, 0.7, "F");
    }
  };

  // ── Page header (pages 2+) ────────────────────────────────

  const drawPageHeader = () => {
    fillPageBg();
    drawWatermark();
    doc.setFillColor(...C_BG);
    doc.rect(0, 0, W, HEADER_H2, "F");
    if (logoData) {
      const ly = (HEADER_H2 - logo2.h) / 2;
      doc.addImage(logoData.base64, "PNG", W - LOGO_PAD - logo2.w, ly, logo2.w, logo2.h, undefined, "FAST");
    }
    drawAccentLine(HEADER_H2);
  };

  // ── Page break ────────────────────────────────────────────

  const pageBreak = (needed: number) => {
    if (y + needed > H - 18) {
      doc.addPage();
      drawPageHeader();
      y = HEADER_H2 + 4;
    }
  };

  // ── Section title — left accent bar ───────────────────────

  const sectionTitle = (title: string) => {
    pageBreak(16);
    // Left accent bar 3px
    doc.setFillColor(...C_ACCENT);
    doc.rect(M, y - 4, 1, 6, "F");
    // Title text
    doc.setFontSize(13);
    doc.setTextColor(...C_TEXT);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), M + 4, y);
    y += 8;
  };

  // ── Note below tables ─────────────────────────────────────

  const addTableNote = () => {
    doc.setFontSize(7);
    doc.setTextColor(...C_MUTED);
    doc.setFont("helvetica", "italic");
    doc.text("Recomendação Nord Research.", M, y);
    y += 6;
  };

  // ── autoTable shared config ───────────────────────────────

  const tableTopMargin = HEADER_H2 + 4;
  const tableStyles = {
    fontSize: 8,
    cellPadding: 1.6,
    lineColor: C_ROW_LINE,
    lineWidth: 0.08,
    textColor: C_SEC,
    fillColor: C_BG,
  };
  const tableHeadStyles = {
    fillColor: C_ZEBRA,
    textColor: C_SILVER,
    fontStyle: "bold" as const,
    lineColor: C_ZEBRA,
    fontSize: 7,
    cellPadding: 1.8,
  };
  const getLastTableY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ── Analysis section renderer ─────────────────────────────

  const renderAnalysis = (ativos: AtivoRelatorio[]) => {
    for (let ai = 0; ai < ativos.length; ai++) {
      const a = ativos[ai];
      const r = researchMap.get(a.ticker);
      if (!r?.analise_texto) continue;

      pageBreak(22);

      // Left accent bar + title
      doc.setFillColor(...C_ACCENT);
      doc.rect(M, y - 4, 1, 6, "F");
      doc.setFontSize(10);
      doc.setTextColor(...C_TEXT);
      doc.setFont("helvetica", "bold");
      doc.text(`${r.nome_empresa} (${a.ticker})`, M + 4, y);
      y += 6;

      // Body text
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const lines: string[] = doc.splitTextToSize(r.analise_texto, CW - 8);

      for (let i = 0; i < lines.length; i++) {
        pageBreak(LH_BODY);
        // Last line bold + bright
        if (i === lines.length - 1 || (
          i >= lines.length - 2 &&
          lines[i].match(/[Ss]ugerimos|[Rr]ecomendamos|[Mm]antemos|[Cc]onclu/)
        )) {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...C_TEXT);
        } else {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...C_SEC);
        }
        doc.text(lines[i], M + 4, y);
        y += LH_BODY;
      }
      doc.setFont("helvetica", "normal");

      // Gradient separator between analyses
      if (ai < ativos.length - 1) {
        y += 3;
        const sepSteps = 30;
        const sepW = CW / sepSteps;
        for (let s = 0; s < sepSteps; s++) {
          const t = s / sepSteps;
          const fade = Math.abs(t - 0.5) * 2; // 1→0→1
          const alpha = 1 - fade;
          const r2 = Math.round(C_ACCENT[0] * alpha + C_BG[0] * (1 - alpha));
          const g2 = Math.round(C_ACCENT[1] * alpha + C_BG[1] * (1 - alpha));
          const b2 = Math.round(C_ACCENT[2] * alpha + C_BG[2] * (1 - alpha));
          doc.setFillColor(r2, g2, b2);
          doc.rect(M + s * sepW, y, sepW + 0.5, 0.3, "F");
        }
        y += 5;
      } else {
        y += 4;
      }
    }
  };

  // ════════════════════════════════════════════════════════════
  //  PAGE 1
  // ════════════════════════════════════════════════════════════

  fillPageBg();
  drawWatermark();

  // Header bar
  doc.setFillColor(...C_BG);
  doc.rect(0, 0, W, HEADER_H1, "F");

  // Title — 22pt bold white
  doc.setFontSize(22);
  doc.setTextColor(...C_TEXT);
  doc.setFont("helvetica", "bold");
  doc.text("Análise de Portfólio", M, 12);

  // Metadata line
  doc.setFontSize(9);
  doc.setTextColor(...C_SEC);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${formatDateBR(relatorio.created_at)}  ·  ${relatorio.nome_cliente}  ·  ${relatorio.objetivo}  ·  ${relatorio.pct_pl_acoes}% PL  ·  ${fmtCurrency(relatorio.valor_total)}`,
    M, 17
  );

  // Logo right-aligned
  if (logoData) {
    const ly = (HEADER_H1 - logo1.h) / 2;
    doc.addImage(logoData.base64, "PNG", W - LOGO_PAD - logo1.w, ly, logo1.w, logo1.h, undefined, "FAST");
  }

  // Accent gradient line below header
  drawAccentLine(HEADER_H1);

  y = HEADER_H1 + 6;

  // ════════════════════════════════════════════════════════════
  //  PORTFÓLIO ATUAL
  // ════════════════════════════════════════════════════════════

  sectionTitle("Portfólio Atual");

  const totalAtual = ativosAtuais.reduce((s, a) => s + a.valor_rs, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: tableTopMargin },
    head: [["#", "TICKER", "VALOR R$", "PESO", "SETOR", "ROE", "P/VPA", "P/L", "EV/EBITDA", "DIV. YIELD", "MOV."]],
    body: [
      ...ativosAtuais.map((a, i) => {
        const r = researchMap.get(a.ticker);
        return [
          String(i + 1),
          a.ticker,
          fmtCurrency(a.valor_rs),
          a.peso.toFixed(2) + "%",
          r?.setor || "—",
          fmt(r?.roe),
          fmt(r?.p_vpa),
          fmt(r?.p_l),
          fmt(r?.ev_ebitda),
          fmt(r?.div_yield),
          capitalize(a.movimentacao || "manter"),
        ];
      }),
      // Total row
      [
        "",
        { content: "TOTAL", styles: { fontStyle: "bold" as const } },
        { content: fmtCurrency(totalAtual), styles: { fontStyle: "bold" as const } },
        { content: "100.00%", styles: { fontStyle: "bold" as const } },
        "", "", "", "", "", "", "",
      ],
    ],
    styles: tableStyles,
    headStyles: tableHeadStyles,
    columnStyles: {
      0: { halign: "center", cellWidth: 7 },
      1: { textColor: C_TEXT, fontStyle: "bold" },
      2: { halign: "right" },
      3: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "center", cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const isTotal = data.row.index === ativosAtuais.length;
        // Alternating dark rows
        if (!isTotal) {
          data.cell.styles.fillColor = data.row.index % 2 === 0 ? C_BG : C_CARD;
        }
        // Total row
        if (isTotal) {
          data.cell.styles.fillColor = C_ZEBRA;
          data.cell.styles.textColor = C_TEXT;
        }
        // Movimentação badge
        if (data.column.index === 10 && !isTotal) {
          const mov = ativosAtuais[data.row.index]?.movimentacao || "manter";
          const badge = MOV_BADGE[mov] || MOV_BADGE.manter;
          data.cell.styles.fillColor = badge.bg;
          data.cell.styles.textColor = badge.text;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.lineColor = badge.border;
          data.cell.styles.lineWidth = 0.3;
        }
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawPageHeader();
    },
  });

  y = getLastTableY() + 3;
  addTableNote();

  // ════════════════════════════════════════════════════════════
  //  MOVIMENTAÇÕES SUGERIDAS
  // ════════════════════════════════════════════════════════════

  sectionTitle("Movimentações Sugeridas");

  const movGroups: Record<string, string[]> = {
    sair: [], reduzir: [], manter: [], aumentar: [], entrar: [],
  };
  for (const a of ativosAtuais) {
    const mov = a.movimentacao || "manter";
    if (movGroups[mov]) movGroups[mov].push(a.ticker);
  }
  for (const a of ativosSugeridos) {
    if (a.movimentacao === "entrar") movGroups.entrar.push(a.ticker);
  }

  const colW = CW / 5;
  const movOrder = ["sair", "reduzir", "manter", "aumentar", "entrar"] as const;
  const movLabels: Record<string, string> = {
    sair: "SAIR", reduzir: "REDUZIR", manter: "MANTER",
    aumentar: "AUMENTAR", entrar: "ENTRAR",
  };

  const maxTickers = Math.max(...Object.values(movGroups).map((g) => g.length), 1);
  const headerH = 8;
  const tickerH = 6.35;
  const totalH = headerH + maxTickers * tickerH;
  pageBreak(totalH + 6);

  movOrder.forEach((mov, i) => {
    const x = M + i * colW;
    const c = MOV_COL[mov];

    // Header — gradient effect: top strip + main
    doc.setFillColor(...c.top);
    doc.rect(x, y, colW, 2, "F");
    doc.setFillColor(...c.main);
    doc.rect(x, y + 2, colW, headerH - 2, "F");

    // Header text
    doc.setFontSize(8);
    doc.setTextColor(...c.text);
    doc.setFont("helvetica", "bold");
    doc.text(
      `${movLabels[mov]} (${movGroups[mov].length})`,
      x + colW / 2, y + 6,
      { align: "center" }
    );

    // Ticker rows
    const rowsY = y + headerH;
    const tickers = movGroups[mov];

    for (let j = 0; j < maxTickers; j++) {
      const ry = rowsY + j * tickerH;

      // Dark bg alternating
      doc.setFillColor(...(j % 2 === 0 ? C_BG : C_CARD));
      doc.rect(x, ry, colW, tickerH, "F");

      // Subtle horizontal line
      doc.setDrawColor(...C_ACCENT);
      doc.setLineWidth(0.05);
      doc.line(x, ry + tickerH, x + colW, ry + tickerH);

      if (j < tickers.length) {
        doc.setFontSize(9);
        doc.setTextColor(...C_SILVER);
        doc.setFont("helvetica", "normal");
        doc.text(tickers[j], x + colW / 2, ry + tickerH / 2 + 1.2, { align: "center" });
      }
    }

    // Subtle vertical separator (no hard borders)
    if (i > 0) {
      doc.setDrawColor(...C_ACCENT);
      doc.setLineWidth(0.05);
      doc.line(x, y, x, y + totalH);
    }
  });

  y += totalH + 10;

  // ════════════════════════════════════════════════════════════
  //  CONSIDERAÇÕES MOVIMENTAÇÕES
  // ════════════════════════════════════════════════════════════

  const ativosComMov = ativosAtuais.filter(
    (a) => a.movimentacao && a.movimentacao !== "manter"
  );

  if (ativosComMov.length > 0) {
    sectionTitle("Considerações sobre as principais movimentações");
    renderAnalysis(ativosComMov);
  }

  // ════════════════════════════════════════════════════════════
  //  PORTFÓLIO SUGERIDO
  // ════════════════════════════════════════════════════════════

  pageBreak(30);
  sectionTitle("Portfólio Sugerido");

  const totalSugerido = ativosSugeridos.reduce((s, a) => s + a.valor_rs, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: tableTopMargin },
    head: [["#", "TICKER", "VALOR R$", "PESO", "SETOR", "ROE", "P/VPA", "P/L", "EV/EBITDA", "DIV. YIELD"]],
    body: [
      ...ativosSugeridos.map((a, i) => {
        const r = researchMap.get(a.ticker);
        return [
          String(i + 1),
          a.ticker,
          fmtCurrency(a.valor_rs),
          a.peso.toFixed(2) + "%",
          r?.setor || "—",
          fmt(r?.roe),
          fmt(r?.p_vpa),
          fmt(r?.p_l),
          fmt(r?.ev_ebitda),
          fmt(r?.div_yield),
        ];
      }),
      [
        "",
        { content: "TOTAL", styles: { fontStyle: "bold" as const } },
        { content: fmtCurrency(totalSugerido), styles: { fontStyle: "bold" as const } },
        { content: "100.00%", styles: { fontStyle: "bold" as const } },
        "", "", "", "", "", "",
      ],
    ],
    styles: tableStyles,
    headStyles: tableHeadStyles,
    columnStyles: {
      0: { halign: "center", cellWidth: 7 },
      1: { textColor: C_TEXT, fontStyle: "bold" },
      2: { halign: "right" },
      3: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const isTotal = data.row.index === ativosSugeridos.length;
        if (!isTotal) {
          data.cell.styles.fillColor = data.row.index % 2 === 0 ? C_BG : C_CARD;
        }
        if (isTotal) {
          data.cell.styles.fillColor = C_ZEBRA;
          data.cell.styles.textColor = C_TEXT;
        }
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawPageHeader();
    },
  });

  y = getLastTableY() + 3;
  addTableNote();

  // ════════════════════════════════════════════════════════════
  //  CONSIDERAÇÕES RECOMENDAÇÕES (novos ativos)
  // ════════════════════════════════════════════════════════════

  const ativosNovos = ativosSugeridos.filter((a) => a.movimentacao === "entrar");

  if (ativosNovos.length > 0) {
    sectionTitle("Considerações sobre as principais recomendações");
    renderAnalysis(ativosNovos);
  }

  // ════════════════════════════════════════════════════════════
  //  DISCLAIMER CVM
  // ════════════════════════════════════════════════════════════

  pageBreak(28);
  y += 4;

  // Gradient separator
  const sepSteps = 40;
  const sepW = CW / sepSteps;
  for (let s = 0; s < sepSteps; s++) {
    const t = s / sepSteps;
    const fade = Math.abs(t - 0.5) * 2;
    const alpha = 1 - fade;
    const r2 = Math.round(C_MUTED[0] * alpha + C_BG[0] * (1 - alpha));
    const g2 = Math.round(C_MUTED[1] * alpha + C_BG[1] * (1 - alpha));
    const b2 = Math.round(C_MUTED[2] * alpha + C_BG[2] * (1 - alpha));
    doc.setFillColor(r2, g2, b2);
    doc.rect(M + s * sepW, y, sepW + 0.5, 0.3, "F");
  }
  y += 4;

  doc.setFontSize(7);
  doc.setTextColor(...C_MUTED);
  doc.setFont("helvetica", "italic");
  const disclaimer =
    "Este relatório tem caráter meramente informativo e não constitui oferta, solicitação ou recomendação de compra ou venda de valores mobiliários. " +
    "As informações aqui contidas são baseadas em fontes consideradas confiáveis, mas não há garantia quanto à sua exatidão ou completude. " +
    "Rentabilidade passada não é garantia de rentabilidade futura. Os investimentos em renda variável envolvem riscos, inclusive de perda do capital investido. " +
    "O investidor deve tomar suas decisões de investimento de forma independente, considerando seus objetivos, situação financeira e tolerância a risco. " +
    "Este material está em conformidade com as normas da Comissão de Valores Mobiliários (CVM).";

  const disclaimerLines: string[] = doc.splitTextToSize(disclaimer, CW);
  for (const line of disclaimerLines) {
    pageBreak(3.5);
    doc.text(line, M, y);
    y += 3;
  }

  // ════════════════════════════════════════════════════════════
  //  FOOTER + WATERMARK — all pages
  // ════════════════════════════════════════════════════════════

  const pageCount = (
    doc as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Subtle bottom line
    doc.setDrawColor(...C_MUTED);
    doc.setLineWidth(0.1);
    doc.line(M, H - 12, W - M, H - 12);

    // Page number
    doc.setFontSize(7);
    doc.setTextColor(...C_MUTED);
    doc.setFont("helvetica", "bold");
    doc.text(`PÁGINA ${i} DE ${pageCount}`, W / 2, H - 8, { align: "center", charSpace: 0.8 });
  }

  // ── Save ──────────────────────────────────────────────────

  const dateStr = new Date(relatorio.created_at).toISOString().split("T")[0];
  doc.save(`relatorio_${relatorio.nome_cliente.replace(/\s+/g, "_")}_${dateStr}.pdf`);
}
