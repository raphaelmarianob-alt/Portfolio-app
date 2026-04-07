"use client";

import { useState, useEffect, use } from "react";
import { exportRelatorioPDF } from "@/lib/pdf-export";

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
  ativos: AtivoRelatorio[];
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

const MOV_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  sair: { bg: "bg-red-500/10", text: "text-red-400", label: "Sair" },
  reduzir: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "Reduzir" },
  manter: { bg: "bg-zinc-500/10", text: "text-zinc-400", label: "Manter" },
  aumentar: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Aumentar" },
  entrar: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Entrar" },
};

const MOV_CARD_COLORS: Record<string, { border: string; bg: string; headerText: string }> = {
  sair: { border: "border-red-500/20", bg: "bg-red-500/5", headerText: "text-red-400" },
  reduzir: { border: "border-yellow-500/20", bg: "bg-yellow-500/5", headerText: "text-yellow-400" },
  manter: { border: "border-zinc-500/20", bg: "bg-zinc-500/5", headerText: "text-zinc-400" },
  aumentar: { border: "border-emerald-500/20", bg: "bg-emerald-500/5", headerText: "text-emerald-400" },
  entrar: { border: "border-blue-500/20", bg: "bg-blue-500/5", headerText: "text-blue-400" },
};

const fmt = (v: number | null | undefined) =>
  v !== null && v !== undefined ? v.toFixed(2) : "—";

const fmtCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function RelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null);
  const [researchMap, setResearchMap] = useState<Map<string, ResearchAtivo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [relRes, researchRes] = await Promise.all([
          fetch(`/api/relatorios/${id}`),
          fetch("/api/research"),
        ]);

        if (!relRes.ok) {
          setError("Relatorio nao encontrado");
          return;
        }

        const relData = await relRes.json();
        setRelatorio(relData);

        if (researchRes.ok) {
          const researchData: ResearchAtivo[] = await researchRes.json();
          setResearchMap(new Map(researchData.map((r) => [r.ticker, r])));
        }
      } catch {
        setError("Erro ao carregar relatorio");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="w-6 h-6 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error || !relatorio) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center text-red-400">
        {error || "Relatorio nao encontrado"}
      </div>
    );
  }

  const ativosAtuais = relatorio.ativos.filter((a) => a.tipo === "atual");
  const ativosSugeridos = relatorio.ativos.filter((a) => a.tipo === "sugerido");

  const movGroups: Record<string, AtivoRelatorio[]> = {
    sair: [],
    reduzir: [],
    manter: [],
    aumentar: [],
    entrar: [],
  };
  for (const a of ativosAtuais) {
    const mov = a.movimentacao || "manter";
    if (movGroups[mov]) movGroups[mov].push(a);
  }
  for (const a of ativosSugeridos) {
    if (a.movimentacao === "entrar") {
      movGroups.entrar.push(a);
    }
  }

  const ativosComMov = ativosAtuais.filter(
    (a) => a.movimentacao && a.movimentacao !== "manter"
  );
  const ativosNovos = ativosSugeridos.filter((a) => a.movimentacao === "entrar");
  const totalAtual = ativosAtuais.reduce((s, a) => s + a.valor_rs, 0);
  const totalSugerido = ativosSugeridos.reduce((s, a) => s + a.valor_rs, 0);

  // Map de valor atual por ticker para calcular mov_rs
  const valorAtualMap = new Map(ativosAtuais.map((a) => [a.ticker, a.valor_rs]));

  const handleExportPDF = async () => {
    await exportRelatorioPDF(relatorio, ativosAtuais, ativosSugeridos, researchMap);
  };

  const renderTable = (ativos: AtivoRelatorio[], total: number, showMovRs = false) => (
    <div className="overflow-x-auto bg-[#12131a] rounded-xl border border-[#1e2030] shadow-[0_4px_6px_rgba(0,0,0,0.3)]">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Ticker</th>
            <th>Empresa</th>
            <th>Setor</th>
            <th className="text-right">Valor R$</th>
            <th className="text-right">Peso %</th>
            <th className="text-right">ROE</th>
            <th className="text-right">P/VPA</th>
            <th className="text-right">P/L</th>
            <th className="text-right">EV/EBITDA</th>
            <th className="text-right">Div. Yield</th>
            <th>Mov.</th>
            {showMovRs && <th className="text-right">Mov. R$</th>}
          </tr>
        </thead>
        <tbody>
          {ativos.map((a, i) => {
            const r = researchMap.get(a.ticker);
            const mov = a.movimentacao || "manter";
            const movStyle = MOV_COLORS[mov] || MOV_COLORS.manter;
            const valorAnterior = valorAtualMap.get(a.ticker) || 0;
            const movRs = a.valor_rs - valorAnterior;
            return (
              <tr key={a.id}>
                <td className="text-[#71717a] text-center">{i + 1}</td>
                <td className="font-medium text-white">{a.ticker}</td>
                <td className="text-[#71717a]">{r?.nome_empresa || "—"}</td>
                <td className="text-[#71717a]">{r?.setor || "—"}</td>
                <td className="text-right text-emerald-400">{fmtCurrency(a.valor_rs)}</td>
                <td className="text-right">{a.peso.toFixed(2)}%</td>
                <td className="text-right">{fmt(r?.roe)}</td>
                <td className="text-right">{fmt(r?.p_vpa)}</td>
                <td className="text-right">{fmt(r?.p_l)}</td>
                <td className="text-right">{fmt(r?.ev_ebitda)}</td>
                <td className="text-right">{fmt(r?.div_yield)}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${movStyle.bg} ${movStyle.text}`}>
                    {movStyle.label}
                  </span>
                </td>
                {showMovRs && (
                  <td className={`text-right text-xs font-medium ${movRs < -0.01 ? "text-red-400" : movRs > 0.01 ? "text-emerald-400" : "text-zinc-400"}`}>
                    {movRs < -0.01 ? "−" : movRs > 0.01 ? "+" : ""}{fmtCurrency(Math.abs(movRs))}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td></td>
            <td className="text-white">Total</td>
            <td></td>
            <td></td>
            <td className="text-right text-emerald-400">{fmtCurrency(total)}</td>
            <td className="text-right text-white">100.00%</td>
            <td colSpan={showMovRs ? 7 : 6}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className="max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Analise de Portfolio — {relatorio.nome_cliente}
          </h1>
          <p className="text-sm text-[#71717a] mt-1">
            {new Date(relatorio.created_at).toLocaleDateString("pt-BR")} · {relatorio.objetivo} · {relatorio.pct_pl_acoes}% do PL
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          className="bg-emerald-500 text-black px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-400"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exportar PDF
          </span>
        </button>
      </div>

      {/* Portfolio Atual */}
      <section className="mb-8">
        <h3 className="text-base font-semibold text-white mb-4 pb-2 border-b border-[#1e2030]">
          Portfolio Atual
        </h3>
        {renderTable(ativosAtuais, totalAtual)}
      </section>

      {/* Movimentacoes Sugeridas */}
      <section className="mb-8">
        <h3 className="text-base font-semibold text-white mb-4 pb-2 border-b border-[#1e2030]">
          Movimentacoes Sugeridas
        </h3>
        <div className="grid grid-cols-5 gap-3">
          {(["sair", "reduzir", "manter", "aumentar", "entrar"] as const).map((mov) => {
            const style = MOV_COLORS[mov];
            const cardStyle = MOV_CARD_COLORS[mov];
            const items = movGroups[mov];
            return (
              <div key={mov} className={`rounded-xl border p-4 ${cardStyle.border} ${cardStyle.bg}`}>
                <h4 className={`text-xs font-semibold mb-3 uppercase tracking-wider ${cardStyle.headerText}`}>
                  {style.label} ({items.length})
                </h4>
                {items.length === 0 ? (
                  <p className="text-xs text-[#71717a]">—</p>
                ) : (
                  <ul className="space-y-1.5">
                    {items.map((a) => (
                      <li key={a.ticker} className="text-xs font-medium text-[#e4e4e7]">
                        {a.ticker}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Consideracoes Movimentacoes */}
      {ativosComMov.length > 0 && (
        <section className="mb-8">
          <h3 className="text-base font-semibold text-white mb-4 pb-2 border-b border-[#1e2030]">
            Consideracoes sobre as Principais Movimentacoes
          </h3>
          <div className="space-y-4">
            {ativosComMov.map((a) => {
              const r = researchMap.get(a.ticker);
              if (!r?.analise_texto) return null;
              return (
                <div key={a.ticker} className="bg-[#12131a] border border-[#1e2030] rounded-xl p-5 shadow-[0_4px_6px_rgba(0,0,0,0.3)]">
                  <h4 className="font-semibold text-emerald-400 underline mb-2">
                    {a.ticker} — {r.nome_empresa}
                  </h4>
                  <p className="text-sm text-[#e4e4e7]/80 leading-relaxed whitespace-pre-wrap">
                    {r.analise_texto}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Portfolio Sugerido */}
      <section className="mb-8">
        <h3 className="text-base font-semibold text-white mb-4 pb-2 border-b border-[#1e2030]">
          Portfolio Sugerido
        </h3>
        {renderTable(ativosSugeridos, totalSugerido, true)}
      </section>

      {/* Consideracoes Recomendacoes (novos ativos) */}
      {ativosNovos.length > 0 && (
        <section className="mb-8">
          <h3 className="text-base font-semibold text-white mb-4 pb-2 border-b border-[#1e2030]">
            Consideracoes sobre as Principais Recomendacoes
          </h3>
          <div className="space-y-4">
            {ativosNovos.map((a) => {
              const r = researchMap.get(a.ticker);
              if (!r?.analise_texto) return null;
              return (
                <div key={a.ticker} className="bg-[#12131a] border border-[#1e2030] rounded-xl p-5 shadow-[0_4px_6px_rgba(0,0,0,0.3)]">
                  <h4 className="font-semibold text-blue-400 underline mb-2">
                    {a.ticker} — {r.nome_empresa}
                  </h4>
                  <p className="text-sm text-[#e4e4e7]/80 leading-relaxed whitespace-pre-wrap">
                    {r.analise_texto}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
