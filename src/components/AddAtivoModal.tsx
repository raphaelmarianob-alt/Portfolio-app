"use client";

import { useState } from "react";

interface Props {
  onClose: () => void;
  onSave: () => void;
}

const emptyForm = {
  ticker: "",
  nome_empresa: "",
  setor: "",
  roe: "",
  p_vpa: "",
  p_l: "",
  ev_ebitda: "",
  div_yield: "",
  pct_max_carteira: "5",
  preco_teto: "",
  classificacao: "value",
  recomendacao: "neutro",
  analise_texto: "",
};

export function AddAtivoModal({ onClose, onSave }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ticker || !form.nome_empresa || !form.setor) {
      setError("Ticker, empresa e setor sao obrigatorios");
      return;
    }

    setSaving(true);
    const payload = {
      ticker: form.ticker.toUpperCase(),
      nome_empresa: form.nome_empresa,
      setor: form.setor,
      roe: form.roe ? parseFloat(form.roe) : null,
      p_vpa: form.p_vpa ? parseFloat(form.p_vpa) : null,
      p_l: form.p_l ? parseFloat(form.p_l) : null,
      ev_ebitda: form.ev_ebitda ? parseFloat(form.ev_ebitda) : null,
      div_yield: form.div_yield ? parseFloat(form.div_yield) : null,
      pct_max_carteira: parseFloat(form.pct_max_carteira) || 0,
      preco_teto: form.preco_teto ? parseFloat(form.preco_teto) : null,
      classificacao: form.classificacao,
      recomendacao: form.recomendacao,
      analise_texto: form.analise_texto,
    };

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSave();
      } else {
        const data = await res.json();
        setError(data.error || "Erro ao salvar");
      }
    } catch {
      setError("Erro de conexao");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#12131a] rounded-xl border border-[#1e2030] shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#1e2030]">
          <h3 className="font-semibold text-[#e4e4e7]">Adicionar Ativo</h3>
          <button onClick={onClose} className="text-[#71717a] hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ticker *" value={form.ticker} onChange={(v) => set("ticker", v)} />
            <Field label="Empresa *" value={form.nome_empresa} onChange={(v) => set("nome_empresa", v)} />
            <Field label="Setor *" value={form.setor} onChange={(v) => set("setor", v)} />
            <Field label="ROE" value={form.roe} onChange={(v) => set("roe", v)} type="number" />
            <Field label="P/VPA" value={form.p_vpa} onChange={(v) => set("p_vpa", v)} type="number" />
            <Field label="P/L" value={form.p_l} onChange={(v) => set("p_l", v)} type="number" />
            <Field label="EV/EBITDA" value={form.ev_ebitda} onChange={(v) => set("ev_ebitda", v)} type="number" />
            <Field label="Div. Yield" value={form.div_yield} onChange={(v) => set("div_yield", v)} type="number" />
            <Field label="% Max Carteira" value={form.pct_max_carteira} onChange={(v) => set("pct_max_carteira", v)} type="number" />
            <Field label="Preco Teto" value={form.preco_teto} onChange={(v) => set("preco_teto", v)} type="number" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#71717a] mb-1">Classificacao</label>
              <select
                value={form.classificacao}
                onChange={(e) => set("classificacao", e.target.value)}
                className="w-full bg-[#1a1b26] border border-[#2e3044] rounded-lg px-2 py-1.5 text-sm text-[#e4e4e7] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              >
                <option value="dividendos">Dividendos</option>
                <option value="growth">Growth</option>
                <option value="value">Value</option>
                <option value="small_cap">Small Cap</option>
                <option value="quality">Quality</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#71717a] mb-1">Recomendacao</label>
              <select
                value={form.recomendacao}
                onChange={(e) => set("recomendacao", e.target.value)}
                className="w-full bg-[#1a1b26] border border-[#2e3044] rounded-lg px-2 py-1.5 text-sm text-[#e4e4e7] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              >
                <option value="comprar">Comprar</option>
                <option value="manter">Manter</option>
                <option value="neutro">Neutro</option>
                <option value="sair">Sair</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#71717a] mb-1">Analise</label>
            <textarea
              value={form.analise_texto}
              onChange={(e) => set("analise_texto", e.target.value)}
              rows={3}
              className="w-full bg-[#1a1b26] border border-[#2e3044] rounded-lg px-2 py-1.5 text-sm text-[#e4e4e7] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#71717a] hover:text-white border border-[#2e3044] rounded-lg hover:border-[#71717a]">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-emerald-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-[#71717a] mb-1">{label}</label>
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#1a1b26] border border-[#2e3044] rounded-lg px-2 py-1.5 text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
      />
    </div>
  );
}
