"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface RelatorioAtivo {
  id: number;
  ticker: string;
  tipo: string;
  valor_rs: number;
  peso: number;
  movimentacao: string | null;
}

interface Relatorio {
  id: number;
  nome_cliente: string;
  data: string;
  objetivo: string;
  pct_pl_acoes: number;
  valor_total: number;
  status: string;
  created_at: string;
  ativos: RelatorioAtivo[];
}

const MOV_BADGE: Record<string, string> = {
  sair: "bg-red-500/10 text-red-400",
  reduzir: "bg-yellow-500/10 text-yellow-400",
  manter: "bg-zinc-500/10 text-zinc-400",
  aumentar: "bg-emerald-500/10 text-emerald-400",
  entrar: "bg-blue-500/10 text-blue-400",
};

export default function HistoricoPage() {
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchRelatorios = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/relatorios");
      if (!res.ok) {
        console.error("Erro ao buscar relatorios:", res.status);
        setRelatorios([]);
        setError("Erro ao carregar relatorios");
        return;
      }
      const data = await res.json();
      setRelatorios(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar relatorios:", err);
      setRelatorios([]);
      setError("Erro de conexao ao carregar relatorios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelatorios();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este relatorio?")) return;
    try {
      await fetch(`/api/relatorios/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Erro ao excluir:", err);
    }
    fetchRelatorios();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Historico de Relatorios</h1>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-6 h-6 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center text-red-400 text-sm">
          {error}
          <button onClick={fetchRelatorios} className="ml-3 text-emerald-400 hover:text-emerald-300 underline">Tentar novamente</button>
        </div>
      ) : relatorios.length === 0 ? (
        <div className="bg-[#12131a] rounded-xl border border-[#1e2030] p-12 text-center text-[#71717a]">
          Nenhum relatorio gerado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {relatorios.map((rel) => (
            <div key={rel.id} className="bg-[#12131a] rounded-xl border border-[#1e2030] shadow-[0_4px_6px_rgba(0,0,0,0.3)]">
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-[#1a1b26] rounded-xl"
                onClick={() => setExpandedId(expandedId === rel.id ? null : rel.id)}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      rel.status === "finalizado"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-yellow-500/10 text-yellow-400"
                    }`}
                  >
                    {rel.status}
                  </span>
                  <div>
                    <span className="font-medium text-white">{rel.nome_cliente}</span>
                    <span className="text-[#71717a] text-sm ml-3">{rel.objetivo}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-[#71717a]">
                  <span className="text-emerald-400 font-medium">{formatCurrency(rel.valor_total)}</span>
                  <span>{rel.ativos.length} ativos</span>
                  <span>{formatDate(rel.created_at)}</span>
                  {rel.status === "finalizado" && (
                    <Link
                      href={`/relatorio/${rel.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-400 hover:text-blue-300 text-xs"
                    >
                      Ver
                    </Link>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(rel.id); }}
                    className="text-[#71717a] hover:text-red-400 text-xs ml-2"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              {expandedId === rel.id && rel.ativos.length > 0 && (
                <div className="border-t border-[#1e2030] p-5">
                  <table>
                    <thead>
                      <tr>
                        <th>Ticker</th>
                        <th>Tipo</th>
                        <th className="text-right">Valor R$</th>
                        <th className="text-right">Peso %</th>
                        <th>Movimentacao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rel.ativos.map((a) => (
                        <tr key={a.id}>
                          <td className="font-medium text-white">{a.ticker}</td>
                          <td>
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                              a.tipo === "sugerido" ? "bg-blue-500/10 text-blue-400" : "bg-zinc-500/10 text-zinc-400"
                            }`}>
                              {a.tipo}
                            </span>
                          </td>
                          <td className="text-right text-emerald-400">{formatCurrency(a.valor_rs)}</td>
                          <td className="text-right">{a.peso.toFixed(2)}%</td>
                          <td>
                            {a.movimentacao ? (
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${MOV_BADGE[a.movimentacao] || "bg-zinc-500/10 text-zinc-400"}`}>
                                {a.movimentacao}
                              </span>
                            ) : (
                              <span className="text-[#71717a]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
