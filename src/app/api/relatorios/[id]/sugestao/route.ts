import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface AtivoAtual {
  ticker: string;
  valor_rs: number;
  peso: number;
}

interface ResearchData {
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
}

const OBJETIVO_CLASSIFICACAO: Record<string, string[]> = {
  Dividendos: ["dividendos"],
  "Small Caps": ["small_cap"],
  Crescimento: ["growth"],
  "Balanceamento Geral": ["growth", "dividendos", "value", "quality"],
  "Redução de Posições": [],
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const relatorio = await prisma.relatorio.findUnique({
      where: { id: parseInt(id) },
      include: { ativos: true },
    });

    if (!relatorio) {
      return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
    }

    const researchBase = await prisma.researchBase.findMany();
    const researchMap = new Map<string, ResearchData>(
      researchBase.map((r) => [r.ticker, r as unknown as ResearchData])
    );

    const ativosAtuais = relatorio.ativos.filter((a) => a.tipo === "atual") as unknown as AtivoAtual[];
    const valorTotal = ativosAtuais.reduce((s, a) => s + a.valor_rs, 0);
    const objetivo = relatorio.objetivo;
    const pctReducao = relatorio.pct_reducao || 0; // 0, 25, 50, 75
    const valorAlvo = pctReducao > 0 ? valorTotal * (1 - pctReducao / 100) : valorTotal;
    const classificacoesAlvo = OBJETIVO_CLASSIFICACAO[objetivo] || ["growth", "dividendos"];

    // Step 1: Classify current holdings
    const movimentacoes: {
      ticker: string;
      nome_empresa: string;
      setor: string;
      valor_rs: number;
      peso: number;
      movimentacao: string;
      recomendacao: string;
      classificacao: string;
      analise_texto: string;
    }[] = [];

    for (const ativo of ativosAtuais) {
      const research = researchMap.get(ativo.ticker);
      let movimentacao = "manter";

      if (!research) {
        movimentacao = "manter";
        movimentacoes.push({
          ticker: ativo.ticker,
          nome_empresa: "",
          setor: "",
          valor_rs: ativo.valor_rs,
          peso: ativo.peso,
          movimentacao,
          recomendacao: "neutro",
          classificacao: "",
          analise_texto: "",
        });
        continue;
      }

      if (objetivo === "Redução de Posições") {
        // Regras específicas para Redução de Posições
        if (research.recomendacao === "sair") {
          movimentacao = "sair";
        } else if (research.recomendacao === "reduzir" || research.recomendacao === "neutro") {
          movimentacao = "reduzir";
        } else if (research.recomendacao === "manter") {
          movimentacao = "manter";
        } else if (research.recomendacao === "comprar") {
          movimentacao = "manter";
        }
      } else {
        // Regras padrão para outros objetivos
        if (research.recomendacao === "sair") {
          movimentacao = "sair";
        } else if (research.recomendacao === "neutro" || research.recomendacao === "reduzir") {
          movimentacao = "reduzir";
        } else if (research.recomendacao === "manter") {
          if (
            research.pct_max_carteira > 0 &&
            ativo.peso > research.pct_max_carteira
          ) {
            movimentacao = "reduzir";
          } else {
            movimentacao = "manter";
          }
        } else if (research.recomendacao === "comprar") {
          if (
            research.pct_max_carteira > 0 &&
            ativo.peso > research.pct_max_carteira
          ) {
            movimentacao = "reduzir";
          } else if (
            research.pct_max_carteira > 0 &&
            ativo.peso < research.pct_max_carteira
          ) {
            movimentacao = "aumentar";
          } else {
            movimentacao = "manter";
          }
        }
      }

      movimentacoes.push({
        ticker: ativo.ticker,
        nome_empresa: research.nome_empresa,
        setor: research.setor,
        valor_rs: ativo.valor_rs,
        peso: ativo.peso,
        movimentacao,
        recomendacao: research.recomendacao,
        classificacao: research.classificacao,
        analise_texto: research.analise_texto,
      });
    }

    // Step 2: Find new assets to enter (only if not "Redução de Posições")
    const tickersAtuais = new Set(ativosAtuais.map((a) => a.ticker));
    const novosAtivos: {
      ticker: string;
      nome_empresa: string;
      setor: string;
      classificacao: string;
      pct_max_carteira: number;
      recomendacao: string;
      analise_texto: string;
      roe: number | null;
      p_vpa: number | null;
      p_l: number | null;
      ev_ebitda: number | null;
      div_yield: number | null;
    }[] = [];

    if (objetivo !== "Redução de Posições") {
      for (const research of researchBase) {
        if (
          research.recomendacao === "comprar" &&
          !tickersAtuais.has(research.ticker) &&
          (classificacoesAlvo.length === 0 ||
            classificacoesAlvo.includes(research.classificacao))
        ) {
          novosAtivos.push({
            ticker: research.ticker,
            nome_empresa: research.nome_empresa,
            setor: research.setor,
            classificacao: research.classificacao,
            pct_max_carteira: research.pct_max_carteira,
            recomendacao: research.recomendacao,
            analise_texto: research.analise_texto,
            roe: research.roe,
            p_vpa: research.p_vpa,
            p_l: research.p_l,
            ev_ebitda: research.ev_ebitda,
            div_yield: research.div_yield,
          });
        }
      }
    }

    // Step 3: Build suggested portfolio
    let capitalLiberado = 0;
    const sugeridos: {
      ticker: string;
      nome_empresa: string;
      setor: string;
      valor_rs: number;
      peso: number;
      movimentacao: string;
      classificacao: string;
    }[] = [];

    if (pctReducao > 0) {
      // === MODO REDUÇÃO DE PATRIMÔNIO ===
      // 1. Remover ativos com recomendacao "sair"
      // 2. Calcular pesos relativos dos restantes (reduzir = metade do peso)
      // 3. Normalizar para 100%
      // 4. Multiplicar cada peso pelo valorAlvo

      const sobreviventes: { m: typeof movimentacoes[0]; rawWeight: number }[] = [];

      for (const m of movimentacoes) {
        const research = researchMap.get(m.ticker);
        if (research?.recomendacao === "sair" || m.movimentacao === "sair") {
          capitalLiberado += m.valor_rs;
          continue;
        }
        if (research?.recomendacao === "reduzir" || research?.recomendacao === "neutro") {
          sobreviventes.push({ m, rawWeight: m.peso * 0.5 });
        } else {
          // manter, comprar, ou sem research → peso integral
          sobreviventes.push({ m, rawWeight: m.peso });
        }
      }

      // Normalizar pesos para somar 100%
      const somaRawWeights = sobreviventes.reduce((s, a) => s + a.rawWeight, 0);

      for (const { m, rawWeight } of sobreviventes) {
        const pesoNorm = somaRawWeights > 0 ? (rawWeight / somaRawWeights) * 100 : 0;
        const novoValor = (pesoNorm / 100) * valorAlvo;
        const diffRs = novoValor - m.valor_rs;

        // Movimentação baseada na diferença de valor
        let mov: string;
        if (diffRs < -0.01) {
          mov = "reduzir";
        } else if (diffRs > 0.01) {
          mov = "aumentar";
        } else {
          mov = "manter";
        }

        capitalLiberado += Math.max(0, m.valor_rs - novoValor);

        sugeridos.push({
          ticker: m.ticker,
          nome_empresa: m.nome_empresa,
          setor: m.setor,
          valor_rs: novoValor,
          peso: pesoNorm,
          movimentacao: mov,
          classificacao: m.classificacao,
        });
      }
    } else {
      // === MODO PADRÃO (sem redução de patrimônio) ===
      for (const m of movimentacoes) {
        const research = researchMap.get(m.ticker);
        if (m.movimentacao === "sair") {
          capitalLiberado += m.valor_rs;
        } else if (m.movimentacao === "reduzir") {
          let targetPeso: number;
          if (objetivo === "Redução de Posições") {
            targetPeso = research?.pct_max_carteira
              ? research.pct_max_carteira / 2
              : m.peso * 0.5;
          } else {
            targetPeso = research?.pct_max_carteira
              ? Math.min(m.peso, research.pct_max_carteira)
              : m.peso * 0.5;
          }
          const targetValor = (targetPeso / 100) * valorTotal;
          const reducao = m.valor_rs - targetValor;
          if (reducao > 0) {
            capitalLiberado += reducao;
            sugeridos.push({
              ticker: m.ticker,
              nome_empresa: m.nome_empresa,
              setor: m.setor,
              valor_rs: targetValor,
              peso: targetPeso,
              movimentacao: "reduzir",
              classificacao: m.classificacao,
            });
          } else {
            sugeridos.push({
              ticker: m.ticker,
              nome_empresa: m.nome_empresa,
              setor: m.setor,
              valor_rs: m.valor_rs,
              peso: m.peso,
              movimentacao: "manter",
              classificacao: m.classificacao,
            });
          }
        } else if (m.movimentacao === "manter") {
          sugeridos.push({
            ticker: m.ticker,
            nome_empresa: m.nome_empresa,
            setor: m.setor,
            valor_rs: m.valor_rs,
            peso: m.peso,
            movimentacao: "manter",
            classificacao: m.classificacao,
          });
        } else if (m.movimentacao === "aumentar") {
          sugeridos.push({
            ticker: m.ticker,
            nome_empresa: m.nome_empresa,
            setor: m.setor,
            valor_rs: m.valor_rs,
            peso: m.peso,
            movimentacao: "aumentar",
            classificacao: m.classificacao,
          });
        }
      }

      // Distribute freed capital to "aumentar" existing and new entries
      const paraAumentar = sugeridos.filter((s) => s.movimentacao === "aumentar");
      const totalSlots = paraAumentar.length + novosAtivos.length;

      if (totalSlots > 0 && capitalLiberado > 0) {
        for (const s of paraAumentar) {
          const research = researchMap.get(s.ticker);
          if (research && research.pct_max_carteira > 0) {
            const targetValor = (research.pct_max_carteira / 100) * valorTotal;
            const aumento = Math.min(targetValor - s.valor_rs, capitalLiberado);
            if (aumento > 0) {
              s.valor_rs += aumento;
              s.peso = (s.valor_rs / valorTotal) * 100;
              capitalLiberado -= aumento;
            }
          }
        }

        if (novosAtivos.length > 0 && capitalLiberado > 0) {
          const totalMaxPeso = novosAtivos.reduce((s, a) => s + (a.pct_max_carteira || 5), 0);
          for (const novo of novosAtivos) {
            const proportion = (novo.pct_max_carteira || 5) / totalMaxPeso;
            const alocacao = capitalLiberado * proportion;
            const maxValor = ((novo.pct_max_carteira || 5) / 100) * valorTotal;
            const valorFinal = Math.min(alocacao, maxValor);

            sugeridos.push({
              ticker: novo.ticker,
              nome_empresa: novo.nome_empresa,
              setor: novo.setor,
              valor_rs: valorFinal,
              peso: (valorFinal / valorTotal) * 100,
              movimentacao: "entrar",
              classificacao: novo.classificacao,
            });
          }
        }
      }
    }

    // Recalculate weights for suggested portfolio
    const totalSugerido = sugeridos.reduce((s, a) => s + a.valor_rs, 0);
    for (const s of sugeridos) {
      s.peso = totalSugerido > 0 ? (s.valor_rs / totalSugerido) * 100 : 0;
    }

    // Sort by peso desc
    sugeridos.sort((a, b) => b.peso - a.peso);

    // Save suggested assets to DB
    const ativosSugeridos = sugeridos.map((s) => ({
      relatorio_id: parseInt(id),
      ticker: s.ticker,
      tipo: "sugerido" as const,
      valor_rs: Math.round(s.valor_rs * 100) / 100,
      peso: Math.round(s.peso * 100) / 100,
      movimentacao: s.movimentacao,
    }));

    // Update movimentacao on current assets
    for (const m of movimentacoes) {
      const existing = relatorio.ativos.find(
        (a) => a.ticker === m.ticker && a.tipo === "atual"
      );
      if (existing) {
        await prisma.relatorioAtivo.update({
          where: { id: existing.id },
          data: { movimentacao: m.movimentacao },
        });
      }
    }

    // Insert suggested assets
    await prisma.relatorioAtivo.createMany({ data: ativosSugeridos });

    // Update report status
    await prisma.relatorio.update({
      where: { id: parseInt(id) },
      data: { status: "finalizado" },
    });

    return NextResponse.json({
      movimentacoes,
      novosAtivos,
      sugeridos,
      capitalLiberado: Math.round(capitalLiberado * 100) / 100,
      valorTotal,
      valorAlvo: Math.round(valorAlvo * 100) / 100,
      pctReducao,
    });
  } catch (error) {
    console.error("POST /api/relatorios/[id]/sugestao error:", error);
    return NextResponse.json({ error: "Erro ao gerar sugestão" }, { status: 500 });
  }
}
