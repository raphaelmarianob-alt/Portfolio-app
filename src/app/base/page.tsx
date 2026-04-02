"use client";

import { useState, useEffect, useCallback } from "react";
import { ResearchTable } from "@/components/ResearchTable";
import { AddAtivoModal } from "@/components/AddAtivoModal";
import { CsvUpload } from "@/components/CsvUpload";

export interface Ativo {
  id: number;
  ticker: string;
  nome_empresa: string;
  setor: string;
  roe: number | null;
  p_vpa: number | null;
  p_l: number | null;
  ev_ebitda: number | null;
  div_yield: number | null;
  pct_max_carteira: number;
  preco_teto: number | null;
  classificacao: string;
  recomendacao: string;
  analise_texto: string;
  updated_at: string;
}

export default function BasePage() {
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState("ticker");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAtivos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, orderBy, order });
      const res = await fetch(`/api/research?${params}`);
      if (!res.ok) {
        console.error("Erro ao buscar ativos:", res.status);
        setAtivos([]);
        return;
      }
      const data = await res.json();
      setAtivos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao buscar ativos:", error);
      setAtivos([]);
    } finally {
      setLoading(false);
    }
  }, [search, orderBy, order]);

  useEffect(() => {
    fetchAtivos();
  }, [fetchAtivos]);

  const handleSort = (col: string) => {
    if (orderBy === col) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(col);
      setOrder("asc");
    }
  };

  const handleUpdate = async (id: number, field: string, value: string | number | null) => {
    await fetch(`/api/research/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    fetchAtivos();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover este ativo?")) return;
    await fetch(`/api/research/${id}`, { method: "DELETE" });
    fetchAtivos();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Base do Research</h1>
        <div className="flex gap-3">
          <CsvUpload onUploadComplete={fetchAtivos} />
          <button
            onClick={() => setShowAdd(true)}
            className="bg-emerald-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-400"
          >
            + Adicionar Ativo
          </button>
        </div>
      </div>

      <div className="mb-5">
        <input
          type="text"
          placeholder="Buscar por ticker, empresa ou setor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md bg-[#1a1b26] border border-[#2e3044] rounded-lg px-4 py-2.5 text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-6 h-6 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <ResearchTable
          ativos={ativos}
          orderBy={orderBy}
          order={order}
          onSort={handleSort}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {showAdd && (
        <AddAtivoModal
          onClose={() => setShowAdd(false)}
          onSave={() => {
            setShowAdd(false);
            fetchAtivos();
          }}
        />
      )}
    </div>
  );
}
