"use client";

import { useState } from "react";

function buildScript(tickers: string[]): string {
  return `(async () => {
  const TICKERS = ${JSON.stringify(tickers)};
  const DELAY = 3000;
  const results = [];

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function extract(text, label) {
    const patterns = [
      new RegExp(label + "[:\\\\s]+([\\\\d.,]+)", "i"),
      new RegExp(label + "\\\\s*\\\\n\\\\s*([\\\\d.,%-]+)", "i"),
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1].replace(",", ".").replace("%", "").trim();
    }
    return "";
  }

  function extractRecomendacao(text) {
    const lower = text.toLowerCase();
    if (lower.includes("recomendação: comprar") || lower.includes("recomendação comprar") || lower.includes("score: comprar")) return "comprar";
    if (lower.includes("recomendação: manter") || lower.includes("recomendação manter") || lower.includes("score: neutro")) return "neutro";
    if (lower.includes("recomendação: reduzir") || lower.includes("recomendação reduzir")) return "reduzir";
    if (lower.includes("recomendação: vender") || lower.includes("recomendação vender") || lower.includes("recomendação: sair") || lower.includes("score: sair")) return "sair";
    return "neutro";
  }

  function extractAnalise(text) {
    const markers = ["Análise", "Tese de Investimento", "Recomendação", "Nossa visão", "Visão geral"];
    for (const marker of markers) {
      const idx = text.indexOf(marker);
      if (idx !== -1) {
        const chunk = text.substring(idx, idx + 2000).split("\\n").filter(l => l.trim().length > 40);
        if (chunk.length > 0) return chunk.slice(0, 5).join(" ").substring(0, 500);
      }
    }
    return "";
  }

  for (let i = 0; i < TICKERS.length; i++) {
    const ticker = TICKERS[i];
    console.log(\`[\${i + 1}/\${TICKERS.length}] Extraindo \${ticker}...\`);

    try {
      window.location.href = "https://bankers.nordinvestimentos.com.br/Asset?active=editTab-141|" + ticker;
      await sleep(DELAY);

      const body = document.body.innerText;
      const nome = body.split("\\n").find(l => l.length > 3 && l.length < 80 && !l.includes("Nord") && !l.includes("Bankers")) || ticker;
      const setor = extract(body, "Setor") || extract(body, "Segmento") || "";
      const roe = extract(body, "ROE");
      const p_vpa = extract(body, "P/VPA") || extract(body, "P\\\\/VPA");
      const p_l = extract(body, "P/L") || extract(body, "P\\\\/L");
      const ev_ebitda = extract(body, "EV/EBITDA") || extract(body, "EV\\\\/EBITDA");
      const div_yield = extract(body, "Dividend Yield") || extract(body, "Div.? ?Yield");
      const recomendacao = extractRecomendacao(body);
      const analise = extractAnalise(body);

      results.push({
        ticker, nome_empresa: nome.trim(), setor, roe, p_vpa, p_l,
        ev_ebitda, div_yield, classificacao: "", recomendacao,
        analise_texto: analise, pct_max_carteira: "", preco_teto: ""
      });
    } catch (err) {
      console.error("Erro em " + ticker + ":", err);
      results.push({ ticker, nome_empresa: "", setor: "", roe: "", p_vpa: "", p_l: "", ev_ebitda: "", div_yield: "", classificacao: "", recomendacao: "neutro", analise_texto: "", pct_max_carteira: "", preco_teto: "" });
    }
  }

  // Gerar CSV
  const headers = ["ticker","nome_empresa","setor","roe","p_vpa","p_l","ev_ebitda","div_yield","classificacao","recomendacao","analise_texto","pct_max_carteira","preco_teto"];
  const csvRows = [headers.join(",")];
  for (const r of results) {
    csvRows.push(headers.map(h => {
      const v = r[h] || "";
      return '"' + String(v).replace(/"/g, '""') + '"';
    }).join(","));
  }
  const csv = csvRows.join("\\n");

  // Download
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "base_research.csv";
  a.click();
  URL.revokeObjectURL(url);
  console.log("✅ Download concluído! " + results.length + " ativos extraídos.");
})();`;
}

export default function ImportarPage() {
  const [tickers, setTickers] = useState("");
  const [script, setScript] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGerar = () => {
    const list = tickers
      .split("\n")
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0);

    if (list.length === 0) return;
    setScript(buildScript(list));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    "Cole os tickers abaixo (um por linha)",
    'Clique em "Gerar Script de Extração"',
    "Abra o site da Nord no Chrome (bankers.nordinvestimentos.com.br)",
    "Abra o Console (F12 → Console)",
    "Cole o script gerado e pressione Enter",
    "Aguarde o download do CSV",
    "Faça upload do CSV na página /base",
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Importar Base do Research</h1>

      {/* Instruções */}
      <div className="bg-[#12131a] rounded-xl border border-[#1e2030] shadow-[0_4px_6px_rgba(0,0,0,0.3)] p-6 mb-5">
        <h3 className="text-sm font-semibold text-[#e4e4e7] mb-3">Como usar</h3>
        <ol className="space-y-1.5">
          {steps.map((step, i) => (
            <li key={i} className="text-sm text-[#71717a] flex gap-2">
              <span className="text-emerald-400 font-semibold min-w-[20px]">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Textarea + Botão */}
      <div className="bg-[#12131a] rounded-xl border border-[#1e2030] shadow-[0_4px_6px_rgba(0,0,0,0.3)] p-6 mb-5">
        <label className="block text-xs text-[#71717a] mb-1.5">Lista de Tickers</label>
        <textarea
          value={tickers}
          onChange={(e) => setTickers(e.target.value)}
          placeholder={"PETR4\nVALE3\nITUB4\nBBDC4\n..."}
          rows={8}
          className="w-full bg-[#1a1b26] border border-[#2e3044] rounded-lg px-3 py-2.5 text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 font-mono resize-y"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleGerar}
            disabled={!tickers.trim()}
            className="bg-emerald-500 text-black px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50"
          >
            Gerar Script de Extração
          </button>
          {script && (
            <span className="text-xs text-[#71717a]">
              {tickers.split("\n").filter((t) => t.trim()).length} tickers
            </span>
          )}
        </div>
      </div>

      {/* Script gerado */}
      {script && (
        <div className="bg-[#12131a] rounded-xl border border-[#1e2030] shadow-[0_4px_6px_rgba(0,0,0,0.3)] p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#e4e4e7]">Script de Extração</h3>
            <button
              onClick={handleCopy}
              className="border border-[#2e3044] text-[#e4e4e7] px-3 py-1.5 rounded-lg text-xs hover:border-emerald-500 flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Copiado!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                  </svg>
                  Copiar Script
                </>
              )}
            </button>
          </div>
          <pre className="bg-[#0d0e14] rounded-lg p-4 text-xs text-[#e4e4e7] font-mono overflow-x-auto max-h-[400px] overflow-y-auto border border-[#1e2030] leading-relaxed">
            {script}
          </pre>
        </div>
      )}
    </div>
  );
}
