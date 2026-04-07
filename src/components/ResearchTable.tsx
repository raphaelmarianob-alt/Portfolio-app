"use client";

import { useState } from "react";
import type { Ativo } from "@/app/base/page";
import { EditableCell } from "./EditableCell";

const columns = [
  { key: "ticker", label: "Ticker" },
  { key: "nome_empresa", label: "Empresa" },
  { key: "setor", label: "Setor" },
  { key: "classificacao", label: "Classif." },
  { key: "recomendacao", label: "Recom." },
  { key: "roe", label: "ROE", type: "number" as const },
  { key: "p_vpa", label: "P/VPA", type: "number" as const },
  { key: "p_l", label: "P/L", type: "number" as const },
  { key: "ev_ebitda", label: "EV/EBITDA", type: "number" as const },
  { key: "div_yield", label: "Div. Yield", type: "number" as const },
  { key: "pct_max_carteira", label: "% Máx. Cart.", type: "number" as const },
  { key: "preco_teto", label: "Preço Teto", type: "number" as const },
];

const recomendacaoStyle: Record<string, { dot: string; text: string }> = {
  comprar: { dot: "bg-emerald-400", text: "text-emerald-400" },
  manter: { dot: "bg-yellow-400", text: "text-yellow-400" },
  neutro: { dot: "bg-zinc-500", text: "text-zinc-400" },
  sair: { dot: "bg-red-400", text: "text-red-400" },
};

interface Props {
  ativos: Ativo[];
  orderBy: string;
  order: "asc" | "desc";
  onSort: (col: string) => void;
  onUpdate: (id: number, field: string, value: string | number | null) => void;
  onDelete: (id: number) => void;
}

export function ResearchTable({ ativos, orderBy, order, onSort, onUpdate, onDelete }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const formatNum = (val: number | null) => {
    if (val === null || val === undefined) return "—";
    return val.toFixed(2);
  };

  return (
    <div className="overflow-x-auto bg-[#12131a] rounded-xl border border-[#1e2030] shadow-[0_4px_6px_rgba(0,0,0,0.3)]">
      <table>
        <thead>
          <tr>
            <th className="w-8"></th>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className="cursor-pointer select-none whitespace-nowrap hover:text-[#e4e4e7]"
              >
                {col.label}
                {orderBy === col.key && (
                  <span className="ml-1 text-emerald-400">{order === "asc" ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
            <th className="w-16">Ações</th>
          </tr>
        </thead>
        <tbody>
          {ativos.length === 0 && (
            <tr>
              <td colSpan={columns.length + 2} className="text-center text-[#71717a] py-12">
                Nenhum ativo na base. Adicione ativos ou faca upload de CSV.
              </td>
            </tr>
          )}
          {ativos.map((ativo) => {
            const recStyle = recomendacaoStyle[ativo.recomendacao] || recomendacaoStyle.neutro;
            return (
              <>
                <tr key={ativo.id}>
                  <td className="text-center">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${recStyle.dot}`}
                      title={ativo.recomendacao}
                    />
                  </td>
                  {columns.map((col) => {
                    const val = ativo[col.key as keyof Ativo];
                    if (col.key === "recomendacao") {
                      return (
                        <td key={col.key}>
                          <EditableCell
                            value={val as string}
                            type="select"
                            options={["comprar", "manter", "neutro", "sair"]}
                            onSave={(v) => onUpdate(ativo.id, col.key, v)}
                          />
                        </td>
                      );
                    }
                    if (col.key === "classificacao") {
                      return (
                        <td key={col.key}>
                          <EditableCell
                            value={val as string}
                            type="select"
                            options={["dividendos", "growth", "value", "small_cap", "quality"]}
                            onSave={(v) => onUpdate(ativo.id, col.key, v)}
                          />
                        </td>
                      );
                    }
                    if (col.type === "number") {
                      return (
                        <td key={col.key} className="text-right">
                          <EditableCell
                            value={formatNum(val as number | null)}
                            type="number"
                            onSave={(v) => onUpdate(ativo.id, col.key, v === "" ? null : parseFloat(v as string))}
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={col.key}>
                        <EditableCell
                          value={val as string}
                          onSave={(v) => onUpdate(ativo.id, col.key, v)}
                        />
                      </td>
                    );
                  })}
                  <td className="text-center">
                    <button
                      onClick={() => setExpandedId(expandedId === ativo.id ? null : ativo.id)}
                      className="text-[#71717a] hover:text-emerald-400 text-xs mr-2"
                      title="Ver analise"
                    >
                      <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(ativo.id)}
                      className="text-[#71717a] hover:text-red-400 text-xs"
                      title="Remover"
                    >
                      <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </td>
                </tr>
                {expandedId === ativo.id && (
                  <tr key={`${ativo.id}-detail`}>
                    <td colSpan={columns.length + 2} className="bg-[#1a1b26] p-4">
                      <div className="text-sm">
                        <strong className="text-emerald-400">Analise — {ativo.ticker}</strong>
                        <EditableCell
                          value={ativo.analise_texto || "Sem analise"}
                          type="textarea"
                          onSave={(v) => onUpdate(ativo.id, "analise_texto", v)}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
