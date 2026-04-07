import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const relatorios = await prisma.relatorio.findMany({
      orderBy: { created_at: "desc" },
      include: { ativos: true },
    });
    return NextResponse.json(relatorios ?? []);
  } catch (error) {
    console.error("GET /api/relatorios error:", error);
    return NextResponse.json({ error: "Erro ao buscar relatórios" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nome_cliente, objetivo, pct_pl_acoes, valor_total, pct_reducao, ativos } = body;

    const relatorio = await prisma.relatorio.create({
      data: {
        nome_cliente,
        objetivo,
        pct_pl_acoes,
        valor_total,
        pct_reducao: pct_reducao ?? null,
        ativos: ativos
          ? { create: ativos }
          : undefined,
      },
      include: { ativos: true },
    });

    return NextResponse.json(relatorio, { status: 201 });
  } catch (error) {
    console.error("POST /api/relatorios error:", error);
    return NextResponse.json({ error: "Erro ao criar relatório" }, { status: 500 });
  }
}
