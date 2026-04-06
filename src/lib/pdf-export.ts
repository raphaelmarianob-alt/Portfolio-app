import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

const fmt = (v: number | null | undefined) =>
  v !== null && v !== undefined ? v.toFixed(2) : "—";

const fmtCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const MOV_COLORS: Record<string, [number, number, number]> = {
  sair: [254, 202, 202],       // red-200
  reduzir: [254, 215, 170],    // orange-200
  manter: [229, 231, 235],     // gray-200
  aumentar: [191, 219, 254],   // blue-200
  entrar: [187, 247, 208],     // green-200
};

const MOV_HEADER_COLORS: Record<string, [number, number, number]> = {
  sair: [220, 38, 38],
  reduzir: [234, 88, 12],
  manter: [107, 114, 128],
  aumentar: [37, 99, 235],
  entrar: [22, 163, 74],
};

export async function exportRelatorioPDF(
  relatorio: RelatorioData,
  ativosAtuais: AtivoRelatorio[],
  ativosSugeridos: AtivoRelatorio[],
  researchMap: Map<string, ResearchAtivo>
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const logoBase64 = await loadLogoBase64();

  const addPageNumber = () => {
    const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, 290, { align: "center" });
    }
  };

  const addSubsequentPageHeader = () => {
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", pageWidth - margin - 30, 5, 30, 12, undefined, "FAST");
    }
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(margin, 19, pageWidth - margin, 19);
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > 270) {
      doc.addPage();
      addSubsequentPageHeader();
      y = 24;
    }
  };

  const addSectionTitle = (title: string) => {
    checkPageBreak(12);
    doc.setFontSize(12);
    doc.setTextColor(26, 35, 50);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, y);
    y += 1;
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;
  };

  // ========== HEADER (first page) ==========
  doc.setFillColor(26, 35, 50);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setFontSize(18);
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.text("Análise de Portfólio", margin, 14);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${relatorio.nome_cliente} · ${new Date(relatorio.created_at).toLocaleDateString("pt-BR")}`,
    margin,
    22
  );

  // Logo on first page (top right)
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", pageWidth - margin - 30, 4, 30, 20, undefined, "FAST");
  }

  y = 36;

  // Info line
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Objetivo: ${relatorio.objetivo}  ·  % PL em Ações: ${relatorio.pct_pl_acoes}%  ·  Valor Total: ${fmtCurrency(relatorio.valor_total)}`,
    margin,
    y
  );
  y += 8;

  // ========== PORTFÓLIO ATUAL ==========
  addSectionTitle("Portfólio Atual");

  const totalAtual = ativosAtuais.reduce((s, a) => s + a.valor_rs, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: 24 },
    head: [["#", "Ticker", "Empresa", "Setor", "Valor R$", "Peso %", "ROE", "P/VPA", "P/L", "EV/EBITDA", "DY", "Mov."]],
    body: [
      ...ativosAtuais.map((a, i) => {
        const r = researchMap.get(a.ticker);
        return [
          String(i + 1),
          a.ticker,
          r?.nome_empresa || "—",
          r?.setor || "—",
          fmtCurrency(a.valor_rs),
          a.peso.toFixed(2) + "%",
          fmt(r?.roe),
          fmt(r?.p_vpa),
          fmt(r?.p_l),
          fmt(r?.ev_ebitda),
          fmt(r?.div_yield),
          (a.movimentacao || "manter").charAt(0).toUpperCase() + (a.movimentacao || "manter").slice(1),
        ];
      }),
      [
        "",
        { content: "Total", styles: { fontStyle: "bold" as const } },
        "",
        "",
        { content: fmtCurrency(totalAtual), styles: { fontStyle: "bold" as const } },
        { content: "100.00%", styles: { fontStyle: "bold" as const } },
        "",
        "",
        "",
        "",
        "",
        "",
      ],
    ],
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [245, 245, 245], textColor: [50, 50, 50], fontStyle: "bold", lineColor: [200, 200, 200] },
    bodyStyles: { textColor: [60, 60, 60] },
    columnStyles: {
      0: { halign: "center", cellWidth: 6 },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 11 && data.row.index < ativosAtuais.length) {
        const mov = ativosAtuais[data.row.index].movimentacao || "manter";
        const color = MOV_COLORS[mov];
        if (color) {
          data.cell.styles.fillColor = color;
        }
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) addSubsequentPageHeader();
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ========== MOVIMENTAÇÕES SUGERIDAS ==========
  addSectionTitle("Movimentações Sugeridas");

  const movGroups: Record<string, string[]> = {
    sair: [],
    reduzir: [],
    manter: [],
    aumentar: [],
    entrar: [],
  };
  for (const a of ativosAtuais) {
    const mov = a.movimentacao || "manter";
    if (movGroups[mov]) movGroups[mov].push(a.ticker);
  }
  for (const a of ativosSugeridos) {
    if (a.movimentacao === "entrar") {
      movGroups.entrar.push(a.ticker);
    }
  }

  const colWidth = contentWidth / 5;
  const movOrder = ["sair", "reduzir", "manter", "aumentar", "entrar"];
  const movLabels: Record<string, string> = {
    sair: "SAIR",
    reduzir: "REDUZIR",
    manter: "MANTER",
    aumentar: "AUMENTAR",
    entrar: "ENTRAR",
  };

  checkPageBreak(30);

  // Headers
  movOrder.forEach((mov, i) => {
    const x = margin + i * colWidth;
    const headerColor = MOV_HEADER_COLORS[mov];
    doc.setFillColor(...headerColor);
    doc.rect(x, y, colWidth - 1, 6, "F");
    doc.setFontSize(7);
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.text(`${movLabels[mov]} (${movGroups[mov].length})`, x + colWidth / 2 - 0.5, y + 4, { align: "center" });
  });
  y += 7;

  // Content
  const maxItems = Math.max(...Object.values(movGroups).map((g) => g.length), 1);
  const cellHeight = 4.5;

  movOrder.forEach((mov, i) => {
    const x = margin + i * colWidth;
    const bgColor = MOV_COLORS[mov];
    doc.setFillColor(...bgColor);
    doc.rect(x, y, colWidth - 1, maxItems * cellHeight + 2, "F");

    doc.setFontSize(7);
    doc.setTextColor(60);
    doc.setFont("helvetica", "normal");
    movGroups[mov].forEach((ticker, j) => {
      doc.text(ticker, x + 2, y + 4 + j * cellHeight);
    });
    if (movGroups[mov].length === 0) {
      doc.setTextColor(150);
      doc.text("—", x + 2, y + 4);
    }
  });

  y += maxItems * cellHeight + 8;

  // ========== CONSIDERAÇÕES MOVIMENTAÇÕES ==========
  const ativosComMov = ativosAtuais.filter(
    (a) => a.movimentacao && a.movimentacao !== "manter"
  );

  if (ativosComMov.length > 0) {
    addSectionTitle("Considerações sobre as Principais Movimentações");

    for (const a of ativosComMov) {
      const r = researchMap.get(a.ticker);
      if (!r?.analise_texto) continue;

      checkPageBreak(25);

      // Ticker title - bold underlined
      doc.setFontSize(9);
      doc.setTextColor(30);
      doc.setFont("helvetica", "bold");
      const titleText = `${a.ticker} — ${r.nome_empresa}`;
      doc.text(titleText, margin, y);
      const titleWidth = doc.getTextWidth(titleText);
      doc.setLineWidth(0.3);
      doc.setDrawColor(30);
      doc.line(margin, y + 0.5, margin + titleWidth, y + 0.5);
      y += 5;

      // Analysis text
      doc.setFontSize(8);
      doc.setTextColor(60);
      doc.setFont("helvetica", "normal");

      const lines = doc.splitTextToSize(r.analise_texto, contentWidth);

      // Make last sentence bold
      for (let i = 0; i < lines.length; i++) {
        checkPageBreak(5);
        if (i === lines.length - 1 || (i >= lines.length - 2 && lines[i].match(/[Ss]ugerimos|[Rr]ecomendamos|[Mm]antemos/))) {
          doc.setFont("helvetica", "bold");
        }
        doc.text(lines[i], margin, y);
        y += 3.5;
      }
      doc.setFont("helvetica", "normal");
      y += 4;
    }
  }

  // ========== PORTFÓLIO SUGERIDO ==========
  checkPageBreak(30);
  addSectionTitle("Portfólio Sugerido");

  const totalSugerido = ativosSugeridos.reduce((s, a) => s + a.valor_rs, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: 24 },
    head: [["#", "Ticker", "Empresa", "Setor", "Valor R$", "Peso %", "ROE", "P/VPA", "P/L", "EV/EBITDA", "DY", "Mov."]],
    body: [
      ...ativosSugeridos.map((a, i) => {
        const r = researchMap.get(a.ticker);
        return [
          String(i + 1),
          a.ticker,
          r?.nome_empresa || "—",
          r?.setor || "—",
          fmtCurrency(a.valor_rs),
          a.peso.toFixed(2) + "%",
          fmt(r?.roe),
          fmt(r?.p_vpa),
          fmt(r?.p_l),
          fmt(r?.ev_ebitda),
          fmt(r?.div_yield),
          (a.movimentacao || "manter").charAt(0).toUpperCase() + (a.movimentacao || "manter").slice(1),
        ];
      }),
      [
        "",
        { content: "Total", styles: { fontStyle: "bold" as const } },
        "",
        "",
        { content: fmtCurrency(totalSugerido), styles: { fontStyle: "bold" as const } },
        { content: "100.00%", styles: { fontStyle: "bold" as const } },
        "",
        "",
        "",
        "",
        "",
        "",
      ],
    ],
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [245, 245, 245], textColor: [50, 50, 50], fontStyle: "bold", lineColor: [200, 200, 200] },
    bodyStyles: { textColor: [60, 60, 60] },
    columnStyles: {
      0: { halign: "center", cellWidth: 6 },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 11 && data.row.index < ativosSugeridos.length) {
        const mov = ativosSugeridos[data.row.index].movimentacao || "manter";
        const color = MOV_COLORS[mov];
        if (color) {
          data.cell.styles.fillColor = color;
        }
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) addSubsequentPageHeader();
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ========== CONSIDERAÇÕES RECOMENDAÇÕES (NOVOS) ==========
  const ativosNovos = ativosSugeridos.filter((a) => a.movimentacao === "entrar");

  if (ativosNovos.length > 0) {
    addSectionTitle("Considerações sobre as Principais Recomendações");

    for (const a of ativosNovos) {
      const r = researchMap.get(a.ticker);
      if (!r?.analise_texto) continue;

      checkPageBreak(25);

      doc.setFontSize(9);
      doc.setTextColor(30);
      doc.setFont("helvetica", "bold");
      const titleText = `${a.ticker} — ${r.nome_empresa}`;
      doc.text(titleText, margin, y);
      const titleWidth = doc.getTextWidth(titleText);
      doc.setLineWidth(0.3);
      doc.setDrawColor(30);
      doc.line(margin, y + 0.5, margin + titleWidth, y + 0.5);
      y += 5;

      doc.setFontSize(8);
      doc.setTextColor(60);
      doc.setFont("helvetica", "normal");

      const lines = doc.splitTextToSize(r.analise_texto, contentWidth);
      for (let i = 0; i < lines.length; i++) {
        checkPageBreak(5);
        if (i === lines.length - 1 || (i >= lines.length - 2 && lines[i].match(/[Ss]ugerimos|[Rr]ecomendamos|[Mm]antemos/))) {
          doc.setFont("helvetica", "bold");
        }
        doc.text(lines[i], margin, y);
        y += 3.5;
      }
      doc.setFont("helvetica", "normal");
      y += 4;
    }
  }

  // ========== DISCLAIMER CVM ==========
  checkPageBreak(25);
  y += 5;
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  y += 5;

  doc.setFontSize(6.5);
  doc.setTextColor(130);
  doc.setFont("helvetica", "italic");
  const disclaimer =
    "Este relatório tem caráter meramente informativo e não constitui oferta, solicitação ou recomendação de compra ou venda de valores mobiliários. " +
    "As informações aqui contidas são baseadas em fontes consideradas confiáveis, mas não há garantia quanto à sua exatidão ou completude. " +
    "Rentabilidade passada não é garantia de rentabilidade futura. Os investimentos em renda variável envolvem riscos, inclusive de perda do capital investido. " +
    "O investidor deve tomar suas decisões de investimento de forma independente, considerando seus objetivos, situação financeira e tolerância a risco. " +
    "Este material está em conformidade com as normas da Comissão de Valores Mobiliários (CVM).";

  const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth);
  for (const line of disclaimerLines) {
    checkPageBreak(4);
    doc.text(line, margin, y);
    y += 3;
  }

  // Add page numbers
  addPageNumber();

  // Save
  const dateStr = new Date(relatorio.created_at).toISOString().split("T")[0];
  doc.save(`relatorio_${relatorio.nome_cliente.replace(/\s+/g, "_")}_${dateStr}.pdf`);
}
