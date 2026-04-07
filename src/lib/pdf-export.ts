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

// ── Colors (RGB tuples) ─────────────────────────────────────

type RGB = [number, number, number];

const C_TEXT: RGB = [26, 26, 26];         // #1a1a1a
const C_DATE: RGB = [85, 85, 85];         // #555555
const C_BORDER: RGB = [204, 204, 204];    // #cccccc
const C_NAVY: RGB = [13, 27, 42];         // #0d1b2a
const C_ALT_ROW: RGB = [248, 249, 250];   // #f8f9fa
const C_FOOTER: RGB = [136, 136, 136];    // #888888
const C_HEADER_DATE: RGB = [160, 174, 192]; // #a0aec0

const MOV_BADGE: Record<string, { bg: RGB; text: RGB; border: RGB }> = {
  sair:     { bg: [248, 215, 218], text: [114, 28, 36],  border: [114, 28, 36] },   // #f8d7da / #721c24
  reduzir:  { bg: [255, 243, 205], text: [133, 100, 4],  border: [133, 100, 4] },   // #fff3cd / #856404
  manter:   { bg: [248, 249, 250], text: [108, 117, 125], border: [108, 117, 125] }, // #f8f9fa / #6c757d
  aumentar: { bg: [212, 237, 218], text: [21, 87, 36],   border: [21, 87, 36] },    // #d4edda / #155724
  entrar:   { bg: [209, 236, 241], text: [12, 84, 96],   border: [12, 84, 96] },    // #d1ecf1 / #0c5460
};


// ── Logo loader (SVG → PNG via canvas) ──────────────────────

interface LogoData {
  base64: string;
  aspectRatio: number; // width / height
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
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        resolve({ base64: canvas.toDataURL("image/png"), aspectRatio });
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
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
  const M = 14;                                 // 40px ≈ 14mm
  const CW = W - M * 2;                        // content width
  let y = M;

  const logoData = await loadLogoBase64();

  // Logo: max 160px (≈56mm) wide, 45px (≈16mm) tall — preserve aspect ratio
  const MAX_LOGO_W = 56;  // 160px ≈ 56mm
  const MAX_LOGO_H1 = 16; // 45px ≈ 16mm (page 1)
  const MAX_LOGO_H2 = 12; // 35px ≈ 12mm (page 2+)
  const ar = logoData?.aspectRatio ?? 2.5;

  // Fit within bounds: try height-first, clamp width
  const fitLogo = (maxH: number) => {
    let h = maxH;
    let w = h * ar;
    if (w > MAX_LOGO_W) { w = MAX_LOGO_W; h = w / ar; }
    return { w, h };
  };
  const logo1 = fitLogo(MAX_LOGO_H1);
  const logo2 = fitLogo(MAX_LOGO_H2);

  // Full-width navy header bar
  const HEADER_H1 = 25;  // 70px ≈ 25mm (page 1)
  const HEADER_H2 = 18;  // smaller for subsequent pages

  // Line heights
  const LH_BODY = 5.3;    // 10pt * 1.5 line-height ≈ 5.3mm

  // ── Subsequent page header (pages 2+) ─────────────────────

  const LOGO_PAD = 3.5; // 10px ≈ 3.5mm padding inside navy bar

  const drawPageHeader = () => {
    // Full-width navy bar
    doc.setFillColor(...C_NAVY);
    doc.rect(0, 0, W, HEADER_H2, "F");
    // Logo right-aligned inside the bar with 10px padding
    if (logoData) {
      const logoY = (HEADER_H2 - logo2.h) / 2;
      doc.addImage(logoData.base64, "PNG", W - LOGO_PAD - logo2.w, logoY, logo2.w, logo2.h, undefined, "FAST");
    }
  };

  // ── Page break ────────────────────────────────────────────

  const pageBreak = (needed: number) => {
    if (y + needed > H - 18) {
      doc.addPage();
      drawPageHeader();
      y = HEADER_H2 + 5;
    }
  };

  // ── Section title (13pt, bold, underlined) ────────────────

  const sectionTitle = (title: string) => {
    pageBreak(16);
    doc.setFontSize(13);
    doc.setTextColor(...C_TEXT);
    doc.setFont("helvetica", "bold");
    doc.text(title, M, y);
    const tw = doc.getTextWidth(title);
    doc.setDrawColor(...C_TEXT);
    doc.setLineWidth(0.3);
    doc.line(M, y + 1, M + tw, y + 1);
    y += 8;
  };

  // ── Note below tables ─────────────────────────────────────

  const addTableNote = () => {
    doc.setFontSize(7);
    doc.setTextColor(...C_NAVY);
    doc.setFont("helvetica", "italic");
    doc.text("Recomendação Nord Research.", M, y);
    y += 6;
  };

  // ── autoTable shared config ───────────────────────────────

  const tableTopMargin = HEADER_H2 + 5;
  const tableStyles = {
    fontSize: 9,
    cellPadding: 1.4,       // 4px ≈ 1.4mm
    lineColor: C_BORDER,
    lineWidth: 0.18,        // 0.5px ≈ 0.18mm
    textColor: C_TEXT,
  };
  const tableHeadStyles = {
    fillColor: C_NAVY,
    textColor: [255, 255, 255] as RGB,
    fontStyle: "bold" as const,
    lineColor: C_NAVY,
    fontSize: 9,
  };
  const getLastTableY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ── Analysis section renderer ─────────────────────────────

  const renderAnalysis = (ativos: AtivoRelatorio[]) => {
    for (const a of ativos) {
      const r = researchMap.get(a.ticker);
      if (!r?.analise_texto) continue;

      pageBreak(22);

      // "- Nome Empresa (TICKER):" bold + underlined, 10pt
      doc.setFontSize(10);
      doc.setTextColor(...C_TEXT);
      doc.setFont("helvetica", "bold");
      const label = `- ${r.nome_empresa} (${a.ticker}):`;
      doc.text(label, M, y);
      const labelW = doc.getTextWidth(label);
      doc.setDrawColor(...C_TEXT);
      doc.setLineWidth(0.3);
      doc.line(M, y + 0.8, M + labelW, y + 0.8);
      y += 6;

      // Body text 10pt, line-height 1.5
      doc.setFontSize(10);
      doc.setTextColor(...C_TEXT);
      doc.setFont("helvetica", "normal");
      const lines: string[] = doc.splitTextToSize(r.analise_texto, CW - 4);

      for (let i = 0; i < lines.length; i++) {
        pageBreak(LH_BODY);
        // Last line(s) bold
        if (
          i >= lines.length - 2 &&
          lines[i].match(/[Ss]ugerimos|[Rr]ecomendamos|[Mm]antemos|[Cc]onclu/)
        ) {
          doc.setFont("helvetica", "bold");
        } else if (i === lines.length - 1) {
          doc.setFont("helvetica", "bold");
        }
        doc.text(lines[i], M + 3, y);
        y += LH_BODY;
      }
      doc.setFont("helvetica", "normal");
      y += 4.2; // 12px spacing between analyses
    }
  };

  // ════════════════════════════════════════════════════════════
  //  PAGE 1 HEADER
  // ════════════════════════════════════════════════════════════

  // Full-width navy header bar
  doc.setFillColor(...C_NAVY);
  doc.rect(0, 0, W, HEADER_H1, "F");

  // Title — 22pt, bold, white, inside the navy bar
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Análise de Portfólio", M, 12);

  // Date — 11pt, light gray, below title inside the bar
  doc.setFontSize(11);
  doc.setTextColor(...C_HEADER_DATE);
  doc.setFont("helvetica", "normal");
  doc.text(formatDateBR(relatorio.created_at), M, 18);

  // Logo right-aligned inside the navy bar with 10px padding
  if (logoData) {
    const logoY = (HEADER_H1 - logo1.h) / 2;
    doc.addImage(logoData.base64, "PNG", W - LOGO_PAD - logo1.w, logoY, logo1.w, logo1.h, undefined, "FAST");
  }

  y = HEADER_H1 + 5;

  // Info line
  doc.setFontSize(10);
  doc.setTextColor(...C_DATE);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${relatorio.nome_cliente}  ·  Objetivo: ${relatorio.objetivo}  ·  % PL em Ações: ${relatorio.pct_pl_acoes}%  ·  Valor Total: ${fmtCurrency(relatorio.valor_total)}`,
    M, y
  );
  y += 10;

  // ════════════════════════════════════════════════════════════
  //  PORTFÓLIO ATUAL
  // ════════════════════════════════════════════════════════════

  sectionTitle("Portfólio Atual:");

  const totalAtual = ativosAtuais.reduce((s, a) => s + a.valor_rs, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: tableTopMargin },
    head: [["#", "Ticker", "Valor R$", "Peso", "Setor", "ROE", "P/VPA", "P/L", "EV/Ebitda", "Div. Yield", "Movimentação"]],
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
        { content: "Total", styles: { fontStyle: "bold" as const } },
        { content: fmtCurrency(totalAtual), styles: { fontStyle: "bold" as const } },
        { content: "100.00%", styles: { fontStyle: "bold" as const } },
        "", "", "", "", "", "", "",
      ],
    ],
    styles: tableStyles,
    headStyles: tableHeadStyles,
    columnStyles: {
      0: { halign: "center", cellWidth: 7 },
      2: { halign: "right" },
      3: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "center", cellWidth: 22 },
    },
    // Alternating row colors + movimentação badge + total row bg
    didParseCell: (data) => {
      if (data.section === "body") {
        const isTotal = data.row.index === ativosAtuais.length;
        // Alternating rows
        if (!isTotal && data.row.index % 2 === 1) {
          data.cell.styles.fillColor = C_ALT_ROW;
        }
        // Total row
        if (isTotal) {
          data.cell.styles.fillColor = C_NAVY;
          data.cell.styles.textColor = [255, 255, 255] as RGB;
        }
        // Movimentação badge
        if (data.column.index === 10 && !isTotal) {
          const mov = ativosAtuais[data.row.index]?.movimentacao || "manter";
          const badge = MOV_BADGE[mov] || MOV_BADGE.manter;
          data.cell.styles.fillColor = badge.bg;
          data.cell.styles.textColor = badge.text;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.lineColor = badge.border;
          data.cell.styles.lineWidth = 0.18;
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
  //  MOVIMENTAÇÕES SUGERIDAS (5 colored columns)
  // ════════════════════════════════════════════════════════════

  sectionTitle("Movimentações Sugeridas:");

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

  // Colors: header bg + thin top bar
  const MOV_COL_HEADER: Record<string, RGB> = {
    sair:     [220, 53, 69],   // #dc3545
    reduzir:  [0, 102, 204],   // #0066cc
    manter:   [0, 102, 204],   // #0066cc
    aumentar: [0, 102, 204],   // #0066cc
    entrar:   [40, 167, 69],   // #28a745
  };
  const MOV_COL_BAR: Record<string, RGB> = {
    sair:     [255, 107, 107], // #ff6b6b
    reduzir:  [77, 166, 255],  // #4da6ff
    manter:   [77, 166, 255],  // #4da6ff
    aumentar: [77, 166, 255],  // #4da6ff
    entrar:   [92, 214, 92],   // #5cd65c
  };

  const maxTickers = Math.max(...Object.values(movGroups).map((g) => g.length), 1);
  const topBarH = 1;           // 3px ≈ 1mm
  const headerH = 7;           // header text area
  const tickerH = 6.35;        // 18px ≈ 6.35mm
  const totalH = topBarH + headerH + maxTickers * tickerH;
  pageBreak(totalH + 6);

  // Outer border
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.18);
  doc.rect(M, y, CW, totalH);

  movOrder.forEach((mov, i) => {
    const x = M + i * colW;

    // ── Top color bar (thin accent) ──
    doc.setFillColor(...MOV_COL_BAR[mov]);
    doc.rect(x, y, colW, topBarH, "F");

    // ── Header background ──
    doc.setFillColor(...MOV_COL_HEADER[mov]);
    doc.rect(x, y + topBarH, colW, headerH, "F");

    // Header text
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(
      `${movLabels[mov]} (${movGroups[mov].length})`,
      x + colW / 2,
      y + topBarH + 5,
      { align: "center" }
    );

    // ── Ticker rows (white bg, bottom border) ──
    const rowsY = y + topBarH + headerH;
    const tickers = movGroups[mov];

    for (let j = 0; j < maxTickers; j++) {
      const ry = rowsY + j * tickerH;

      // White background
      doc.setFillColor(255, 255, 255);
      doc.rect(x, ry, colW, tickerH, "F");

      // Bottom border
      doc.setDrawColor(224, 224, 224); // #e0e0e0
      doc.setLineWidth(0.1);
      doc.line(x, ry + tickerH, x + colW, ry + tickerH);

      // Ticker text (or empty)
      if (j < tickers.length) {
        doc.setFontSize(9);
        doc.setTextColor(...C_TEXT);
        doc.setFont("helvetica", "normal");
        doc.text(tickers[j], x + colW / 2, ry + tickerH / 2 + 1.2, { align: "center" });
      }
    }

    // Vertical column separator
    if (i > 0) {
      doc.setDrawColor(...C_BORDER);
      doc.setLineWidth(0.18);
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
    sectionTitle("Considerações sobre as principais movimentações:");
    renderAnalysis(ativosComMov);
  }

  // ════════════════════════════════════════════════════════════
  //  PORTFÓLIO SUGERIDO (sem Movimentação)
  // ════════════════════════════════════════════════════════════

  pageBreak(30);
  sectionTitle("Portfólio Sugerido:");

  const totalSugerido = ativosSugeridos.reduce((s, a) => s + a.valor_rs, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: tableTopMargin },
    head: [["#", "Ticker", "Valor R$", "Peso", "Setor", "ROE", "P/VPA", "P/L", "EV/Ebitda", "Div. Yield"]],
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
        { content: "Total", styles: { fontStyle: "bold" as const } },
        { content: fmtCurrency(totalSugerido), styles: { fontStyle: "bold" as const } },
        { content: "100.00%", styles: { fontStyle: "bold" as const } },
        "", "", "", "", "", "",
      ],
    ],
    styles: tableStyles,
    headStyles: tableHeadStyles,
    columnStyles: {
      0: { halign: "center", cellWidth: 7 },
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
        if (!isTotal && data.row.index % 2 === 1) {
          data.cell.styles.fillColor = C_ALT_ROW;
        }
        if (isTotal) {
          data.cell.styles.fillColor = C_NAVY;
          data.cell.styles.textColor = [255, 255, 255] as RGB;
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
    sectionTitle("Considerações sobre as principais recomendações:");
    renderAnalysis(ativosNovos);
  }

  // ════════════════════════════════════════════════════════════
  //  DISCLAIMER CVM (última página)
  // ════════════════════════════════════════════════════════════

  pageBreak(28);
  y += 4;
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.18);
  doc.line(M, y, W - M, y);
  y += 4;

  doc.setFontSize(7);
  doc.setTextColor(...C_FOOTER);
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
  //  FOOTER — page numbers + bottom line (all pages)
  // ════════════════════════════════════════════════════════════

  const pageCount = (
    doc as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Bottom line
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.18);
    doc.line(M, H - 12, W - M, H - 12);
    // Page number
    doc.setFontSize(8);
    doc.setTextColor(...C_FOOTER);
    doc.setFont("helvetica", "normal");
    doc.text(`Página ${i} de ${pageCount}`, W / 2, H - 8, { align: "center" });
  }

  // ── Save ──────────────────────────────────────────────────

  const dateStr = new Date(relatorio.created_at).toISOString().split("T")[0];
  doc.save(`relatorio_${relatorio.nome_cliente.replace(/\s+/g, "_")}_${dateStr}.pdf`);
}
