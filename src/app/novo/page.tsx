"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import type { Ativo } from "@/app/base/page";

interface CarteiraRow {
  ticker: string;
  valor_rs: number;
  peso: number;
  setor?: string;
  roe?: number | null;
  p_vpa?: number | null;
  p_l?: number | null;
  ev_ebitda?: number | null;
  div_yield?: number | null;
}

const objetivos = [
  "Dividendos",
  "Small Caps",
  "Reducao de Posicoes",
  "Crescimento",
  "Balanceamento Geral",
];

export default function NovoPage() {
  const router = useRouter();
  const [nomeCliente, setNomeCliente] = useState("");
  const [pctPl, setPctPl] = useState("");
  const [objetivo, setObjetivo] = useState(objetivos[0]);
  const [pctReducao, setPctReducao] = useState("");
  const [carteira, setCarteira] = useState<CarteiraRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [inputMode, setInputMode] = useState<"csv" | "manual">("csv");
  const fileRef = useRef<HTMLInputElement>(null);

  const enrichCarteira = async (rows: CarteiraRow[]) => {
    try {
      const res = await fetch("/api/research");
      if (!res.ok) return rows.map((r) => ({ ...r, ticker: r.ticker.toUpperCase() }));
      const data = await res.json();
      const base: Ativo[] = Array.isArray(data) ? data : [];
      const map = new Map(base.map((a) => [a.ticker, a]));

      return rows.map((row) => {
        const match = map.get(row.ticker.toUpperCase());
        if (match) {
          return {
            ...row,
            ticker: row.ticker.toUpperCase(),
            setor: match.setor,
            roe: match.roe,
            p_vpa: match.p_vpa,
            p_l: match.p_l,
            ev_ebitda: match.ev_ebitda,
            div_yield: match.div_yield,
          };
        }
        return { ...row, ticker: row.ticker.toUpperCase() };
      });
    } catch (err) {
      console.error("Erro ao enriquecer carteira:", err);
      return rows.map((r) => ({ ...r, ticker: r.ticker.toUpperCase() }));
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const { data } = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    const rows: CarteiraRow[] = data
      .filter((r) => r.ticker)
      .map((r) => ({
        ticker: r.ticker.trim().toUpperCase(),
        valor_rs: parseFloat(r.valor_rs || "0"),
        peso: parseFloat(r.peso || "0"),
      }));

    const enriched = await enrichCarteira(rows);
    setCarteira(enriched);
    if (fileRef.current) fileRef.current.value = "";
  };

  const addManualRow = () => {
    setCarteira([...carteira, { ticker: "", valor_rs: 0, peso: 0 }]);
  };

  const updateRow = (idx: number, field: keyof CarteiraRow, value: string) => {
    setCarteira((prev) => {
      const updated = [...prev];
      const row = { ...updated[idx] };
      if (field === "valor_rs" || field === "peso") {
        row[field] = parseFloat(value) || 0;
      } else if (field === "ticker") {
        row[field] = value;
      }
      updated[idx] = row;
      return updated;
    });
  };

  const removeRow = (idx: number) => {
    setCarteira((prev) => prev.filter((_, i) => i !== idx));
  };

  const enrichManual = async () => {
    const enriched = await enrichCarteira(carteira);
    setCarteira(enriched);
  };

  const totalValor = carteira.reduce((s, r) => s + r.valor_rs, 0);
  const totalPeso = carteira.reduce((s, r) => s + r.peso, 0);

  const avgField = (field: keyof CarteiraRow) => {
    const vals = carteira.filter((r) => r[field] !== null && r[field] !== undefined);
    if (vals.length === 0) return null;
    return (vals.reduce((s, r) => s + (Number(r[field]) || 0), 0) / vals.length);
  };

  const fmt = (v: number | null | undefined) => (v !== null && v !== undefined ? v.toFixed(2) : "—");

  const handleSave = async () => {
    if (!nomeCliente || carteira.length === 0) return;
    setSaving(true);

    try {
      const res = await fetch("/api/relatorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_cliente: nomeCliente,
          objetivo,
          pct_pl_acoes: parseFloat(pctPl) || 0,
          pct_reducao: pctReducao ? parseFloat(pctReducao) : null,
          valor_total: totalValor,
          ativos: carteira.map((r) => ({
            ticker: r.ticker,
            tipo: "atual",
            valor_rs: r.valor_rs,
            peso: r.peso,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSaved(true);
        setSavedId(data.id);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGerarSugestao = async () => {
    if (!savedId && !nomeCliente) return;
    setGenerating(true);
    setErro(null);

    try {
      let relatorioId = savedId;

      if (!relatorioId) {
        const res = await fetch("/api/relatorios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome_cliente: nomeCliente,
            objetivo,
            pct_pl_acoes: parseFloat(pctPl) || 0,
            pct_reducao: pctReducao ? parseFloat(pctReducao) : null,
            valor_total: totalValor,
            ativos: carteira.map((r) => ({
              ticker: r.ticker,
              tipo: "atual",
              valor_rs: r.valor_rs,
              peso: r.peso,
            })),
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error("Erro ao salvar relatorio:", errData);
          setErro("Erro ao salvar relatório. Tente novamente.");
          return;
        }
        const data = await res.json();
        relatorioId = data.id;
        setSavedId(relatorioId);
      }

      const sugRes = await fetch(`/api/relatorios/${relatorioId}/sugestao`, {
        method: "POST",
      });

      if (sugRes.ok) {
        router.push(`/relatorio/${relatorioId}`);
      } else {
        const errData = await sugRes.json().catch(() => ({}));
        console.error("Erro ao gerar sugestão:", errData);
        setErro("Erro ao gerar sugestão. Tente novamente.");
      }
    } catch (err) {
      console.error("Erro inesperado ao gerar sugestão:", err);
      setErro("Erro ao gerar sugestão. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Novo Relatorio</h1>

      <div className="bg-[#12131a] rounded-xl border border-[#1e2030] shadow-[0_4px_6px_rgba(0,0,0,0.3)] p-6 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-[#71717a] mb-1.5">Nome do Cliente</label>
            <input
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              className="w-full bg-[#1a1b26] border border-[#2e3044] rounded-lg px-3 py-2.5 text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              placeholder="Nome do cliente"
            />
          </div>
          <div>
            <label className="block text-xs text-[#71717a] mb-1.5">% do PL em Acoes</label>
            <input
              type="number"
              step="0.1"
              value={pctPl}
              onChange={(e) => setPctPl(e.target.value)}
              className="w-full bg-[#1a1b26] border border-[#2e3044] rounded-lg px-3 py-2.5 text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              placeholder="Ex: 30"
            />
          </div>
          <div>
            <label className="block text-xs text-[#71717a] mb-1.5">Objetivo</label>
            <select
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              className="w-full bg-[#1a1b26] border border-[#2e3044] rounded-lg px-3 py-2.5 text-sm text-[#e4e4e7] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            >
              {objetivos.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#71717a] mb-1.5">Reducao do Patrimonio em Acoes</label>
            <select
              value={pctReducao}
              onChange={(e) => setPctReducao(e.target.value)}
              className="w-full bg-[#1a1b26] border border-[#2e3044] rounded-lg px-3 py-2.5 text-sm text-[#e4e4e7] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            >
              <option value="">Nenhuma</option>
              <option value="25">25%</option>
              <option value="50">50%</option>
              <option value="75">75%</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-[#12131a] rounded-xl border border-[#1e2030] shadow-[0_4px_6px_rgba(0,0,0,0.3)] p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#e4e4e7]">Carteira Atual</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode("csv")}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium ${inputMode === "csv" ? "bg-emerald-500 text-black" : "border border-[#2e3044] text-[#71717a] hover:text-white hover:border-[#71717a]"}`}
            >
              Upload CSV
            </button>
            <button
              onClick={() => setInputMode("manual")}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium ${inputMode === "manual" ? "bg-emerald-500 text-black" : "border border-[#2e3044] text-[#71717a] hover:text-white hover:border-[#71717a]"}`}
            >
              Manual
            </button>
          </div>
        </div>

        {inputMode === "csv" ? (
          <div className="mb-4">
            <label
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center border-2 border-dashed border-[#2e3044] rounded-xl p-6 cursor-pointer hover:border-emerald-500 hover:bg-emerald-500/5"
            >
              <svg className="w-8 h-8 text-[#71717a] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-sm text-[#71717a]">Clique para fazer upload do CSV</span>
              <span className="text-xs text-[#71717a] mt-1">Colunas: ticker, valor_rs, peso</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex gap-2 mb-4">
            <button
              onClick={addManualRow}
              className="border border-[#2e3044] text-[#e4e4e7] px-3 py-1.5 rounded-lg text-xs hover:border-emerald-500"
            >
              + Linha
            </button>
            {carteira.length > 0 && (
              <button
                onClick={enrichManual}
                className="border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg text-xs hover:bg-blue-500/10"
              >
                Enriquecer da Base
              </button>
            )}
          </div>
        )}

        {carteira.length > 0 && (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Ticker</th>
                  <th className="text-right">Valor R$</th>
                  <th className="text-right">Peso %</th>
                  <th>Setor</th>
                  <th className="text-right">ROE</th>
                  <th className="text-right">P/VPA</th>
                  <th className="text-right">P/L</th>
                  <th className="text-right">EV/EBITDA</th>
                  <th className="text-right">Div. Yield</th>
                  {inputMode === "manual" && <th className="w-8"></th>}
                </tr>
              </thead>
              <tbody>
                {carteira.map((row, idx) => (
                  <tr key={idx}>
                    <td className="text-[#71717a] text-center">{idx + 1}</td>
                    {inputMode === "manual" ? (
                      <>
                        <td>
                          <input
                            value={row.ticker}
                            onChange={(e) => updateRow(idx, "ticker", e.target.value)}
                            className="bg-[#1a1b26] border border-[#2e3044] rounded-lg px-1 py-0.5 text-sm w-20 text-[#e4e4e7]"
                          />
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={row.valor_rs || ""}
                            onChange={(e) => updateRow(idx, "valor_rs", e.target.value)}
                            className="bg-[#1a1b26] border border-[#2e3044] rounded-lg px-1 py-0.5 text-sm w-24 text-right text-[#e4e4e7]"
                          />
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={row.peso || ""}
                            onChange={(e) => updateRow(idx, "peso", e.target.value)}
                            className="bg-[#1a1b26] border border-[#2e3044] rounded-lg px-1 py-0.5 text-sm w-16 text-right text-[#e4e4e7]"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="font-medium text-white">{row.ticker}</td>
                        <td className="text-right text-emerald-400">{row.valor_rs.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td className="text-right">{row.peso.toFixed(2)}%</td>
                      </>
                    )}
                    <td className="text-[#71717a]">{row.setor || "—"}</td>
                    <td className="text-right">{fmt(row.roe)}</td>
                    <td className="text-right">{fmt(row.p_vpa)}</td>
                    <td className="text-right">{fmt(row.p_l)}</td>
                    <td className="text-right">{fmt(row.ev_ebitda)}</td>
                    <td className="text-right">{fmt(row.div_yield)}</td>
                    {inputMode === "manual" && (
                      <td>
                        <button onClick={() => removeRow(idx)} className="text-[#71717a] hover:text-red-400 text-xs">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td></td>
                  <td className="text-[#e4e4e7]">Total / Media</td>
                  <td className="text-right text-emerald-400">{totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="text-right text-[#e4e4e7]">{totalPeso.toFixed(2)}%</td>
                  <td></td>
                  <td className="text-right">{fmt(avgField("roe"))}</td>
                  <td className="text-right">{fmt(avgField("p_vpa"))}</td>
                  <td className="text-right">{fmt(avgField("p_l"))}</td>
                  <td className="text-right">{fmt(avgField("ev_ebitda"))}</td>
                  <td className="text-right">{fmt(avgField("div_yield"))}</td>
                  {inputMode === "manual" && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !nomeCliente || carteira.length === 0}
          className="border border-[#2e3044] text-[#e4e4e7] px-5 py-2.5 rounded-lg text-sm font-semibold hover:border-emerald-500 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Rascunho"}
        </button>
        <button
          onClick={handleGerarSugestao}
          disabled={generating || !nomeCliente || carteira.length === 0}
          className="bg-emerald-500 text-black px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Gerando...
            </span>
          ) : "Gerar Sugestao"}
        </button>
        {saved && (
          <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400">
            Relatorio salvo com sucesso!
          </span>
        )}
        {erro && (
          <span className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400">
            {erro}
          </span>
        )}
      </div>
    </div>
  );
}
