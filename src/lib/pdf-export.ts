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
const C_HEAD_BG: RGB = [240, 240, 240];   // #f0f0f0
const C_ALT_ROW: RGB = [250, 250, 250];   // #fafafa
const C_FOOTER: RGB = [136, 136, 136];    // #888888

const MOV_BADGE: Record<string, { bg: RGB; text: RGB; border: RGB }> = {
  sair:     { bg: [254, 226, 226], text: [220, 38, 38],  border: [220, 38, 38] },   // #fee2e2 / #dc2626
  reduzir:  { bg: [255, 237, 213], text: [234, 88, 12],  border: [234, 88, 12] },   // #ffedd5 / #ea580c
  manter:   { bg: [243, 244, 246], text: [107, 114, 128], border: [107, 114, 128] }, // #f3f4f6 / #6b7280
  aumentar: { bg: [220, 252, 231], text: [22, 163, 74],  border: [22, 163, 74] },   // #dcfce7 / #16a34a
  entrar:   { bg: [219, 234, 254], text: [37, 99, 235],  border: [37, 99, 235] },   // #dbeafe / #2563eb
};

const MOV_HEADER_BG: Record<string, RGB> = {
  sair:     [220, 38, 38],    // #dc2626
  reduzir:  [234, 88, 12],    // #ea580c
  manter:   [107, 114, 128],  // #6b7280
  aumentar: [22, 163, 74],    // #16a34a
  entrar:   [37, 99, 235],    // #2563eb
};

const MOV_CELL_BG: Record<string, RGB> = {
  sair:     [255, 245, 245],
  reduzir:  [255, 251, 245],
  manter:   [250, 250, 252],
  aumentar: [245, 255, 248],
  entrar:   [245, 249, 255],
};

// ── Logo loader (SVG → PNG via canvas) ──────────────────────

async function loadLogoBase64(): Promise<string | null> {
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
        resolve(canvas.toDataURL("image/png"));
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

  const logoBase64 = await loadLogoBase64();

  // Logo dimensions (aspect ratio preserved)
  const LOGO_H1 = 16;  // 45px ≈ 16mm (page 1)
  const LOGO_H2 = 12;  // 35px ≈ 12mm (page 2+)
  const LOGO_W1 = LOGO_H1 * 2.5; // approximate aspect ratio
  const LOGO_W2 = LOGO_H2 * 2.5;

  // Navy background block for logo (#0a1628)
  const NAVY_BG: RGB = [10, 22, 40];
  const BLOCK_W1 = 63;  // ~180px for page 1
  const BLOCK_H1 = 21;  // ~60px for page 1
  const BLOCK_W2 = 50;  // smaller for subsequent pages
  const BLOCK_H2 = 17;

  // Line heights
  const LH_BODY = 5.3;    // 10pt * 1.5 line-height ≈ 5.3mm

  // ── Subsequent page header (pages 2+) ─────────────────────

  const drawPageHeader = () => {
    // Navy rectangle at top right
    const blockX = W - BLOCK_W2;
    doc.setFillColor(...NAVY_BG);
    doc.rect(blockX, 0, BLOCK_W2, BLOCK_H2, "F");
    // Logo centered inside the navy block
    if (logoBase64) {
      const logoX = blockX + (BLOCK_W2 - LOGO_W2) / 2;
      const logoY = (BLOCK_H2 - LOGO_H2) / 2;
      doc.addImage(logoBase64, "PNG", logoX, logoY, LOGO_W2, LOGO_H2, undefined, "FAST");
    }
    // Horizontal line below
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.18);
    doc.line(M, BLOCK_H2 + 2, W - M, BLOCK_H2 + 2);
  };

  // ── Page break ────────────────────────────────────────────

  const pageBreak = (needed: number) => {
    if (y + needed > H - 18) {
      doc.addPage();
      drawPageHeader();
      y = M + LOGO_H2 + 5;
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
    doc.setTextColor(...C_FOOTER);
    doc.setFont("helvetica", "italic");
    doc.text("Recomendação Nord Research.", M, y);
    y += 6;
  };

  // ── autoTable shared config ───────────────────────────────

  const tableTopMargin = M + LOGO_H2 + 5;
  const tableStyles = {
    fontSize: 9,
    cellPadding: 1.4,       // 4px ≈ 1.4mm
    lineColor: C_BORDER,
    lineWidth: 0.18,        // 0.5px ≈ 0.18mm
    textColor: C_TEXT,
  };
  const tableHeadStyles = {
    fillColor: C_HEAD_BG,
    textColor: C_TEXT,
    fontStyle: "bold" as const,
    lineColor: C_BORDER,
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

  // Title — 22pt, bold, #1a1a1a
  doc.setFontSize(22);
  doc.setTextColor(...C_TEXT);
  doc.setFont("helvetica", "bold");
  doc.text("Análise de Portfólio", M, y + 7);

  // Date — 11pt, #555555, below title
  doc.setFontSize(11);
  doc.setTextColor(...C_DATE);
  doc.setFont("helvetica", "normal");
  doc.text(formatDateBR(relatorio.created_at), M, y + 13);

  // Navy block + Logo — right side, height 45px (16mm)
  const block1X = W - BLOCK_W1;
  doc.setFillColor(...NAVY_BG);
  doc.rect(block1X, 0, BLOCK_W1, BLOCK_H1, "F");
  if (logoBase64) {
    const logoX = block1X + (BLOCK_W1 - LOGO_W1) / 2;
    const logoY = (BLOCK_H1 - LOGO_H1) / 2;
    doc.addImage(logoBase64, "PNG", logoX, logoY, LOGO_W1, LOGO_H1, undefined, "FAST");
  }

  // No separator line on page 1
  y += 20;

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
          data.cell.styles.fillColor = C_HEAD_BG;
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

  const maxTickers = Math.max(...Object.values(movGroups).map((g) => g.length), 1);
  const headerH = 7;
  const tickerH = 5;
  const bodyH = maxTickers * tickerH + 4;
  pageBreak(headerH + bodyH + 4);

  // Draw outer border
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.18);
  doc.rect(M, y, CW, headerH + bodyH);

  // Column headers
  movOrder.forEach((mov, i) => {
    const x = M + i * colW;
    doc.setFillColor(...MOV_HEADER_BG[mov]);
    doc.rect(x, y, colW, headerH, "F");
    // Vertical separator
    if (i > 0) {
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.3);
      doc.line(x, y, x, y + headerH);
    }
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(
      `${movLabels[mov]} (${movGroups[mov].length})`,
      x + colW / 2,
      y + 5,
      { align: "center" }
    );
  });

  const bodyY = y + headerH;

  // Column bodies
  movOrder.forEach((mov, i) => {
    const x = M + i * colW;
    doc.setFillColor(...MOV_CELL_BG[mov]);
    doc.rect(x, bodyY, colW, bodyH, "F");
    // Vertical borders
    if (i > 0) {
      doc.setDrawColor(...C_BORDER);
      doc.setLineWidth(0.18);
      doc.line(x, bodyY, x, bodyY + bodyH);
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C_TEXT);
    const tickers = movGroups[mov];
    if (tickers.length === 0) {
      doc.setTextColor(...C_FOOTER);
      doc.text("—", x + colW / 2, bodyY + 5, { align: "center" });
    } else {
      tickers.forEach((ticker, j) => {
        doc.text(ticker, x + colW / 2, bodyY + 5 + j * tickerH, { align: "center" });
      });
    }
  });

  y = bodyY + bodyH + 10;

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
          data.cell.styles.fillColor = C_HEAD_BG;
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
