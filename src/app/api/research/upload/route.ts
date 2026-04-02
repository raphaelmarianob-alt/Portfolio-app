import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const text = await file.text();
    const { data, errors } = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: "Erro ao processar CSV", details: errors }, { status: 400 });
    }

    let created = 0;
    let updated = 0;

    for (const row of data) {
      const ticker = (row.ticker || "").trim().toUpperCase();
      if (!ticker) continue;

      const record = {
        ticker,
        nome_empresa: row.nome_empresa || "",
        setor: row.setor || "",
        roe: row.roe ? parseFloat(row.roe) : null,
        p_vpa: row.p_vpa ? parseFloat(row.p_vpa) : null,
        p_l: row.p_l ? parseFloat(row.p_l) : null,
        ev_ebitda: row.ev_ebitda ? parseFloat(row.ev_ebitda) : null,
        div_yield: row.div_yield ? parseFloat(row.div_yield) : null,
        pct_max_carteira: row.pct_max_carteira ? parseFloat(row.pct_max_carteira) : 0,
        preco_teto: row.preco_teto ? parseFloat(row.preco_teto) : null,
        classificacao: row.classificacao || "value",
        recomendacao: row.recomendacao || "neutro",
        analise_texto: row.analise_texto || "",
      };

      const existing = await prisma.researchBase.findUnique({ where: { ticker } });
      if (existing) {
        await prisma.researchBase.update({ where: { ticker }, data: record });
        updated++;
      } else {
        await prisma.researchBase.create({ data: record });
        created++;
      }
    }

    return NextResponse.json({ created, updated, total: data.length });
  } catch (error) {
    console.error("POST /api/research/upload error:", error);
    return NextResponse.json({ error: "Erro ao processar upload" }, { status: 500 });
  }
}
