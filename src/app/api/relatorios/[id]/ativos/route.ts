import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    await prisma.relatorioAtivo.deleteMany({
      where: { relatorio_id: parseInt(id) },
    });

    const ativos = await prisma.relatorioAtivo.createMany({
      data: body.ativos.map((a: { ticker: string; tipo: string; valor_rs: number; peso: number; movimentacao?: string }) => ({
        ...a,
        relatorio_id: parseInt(id),
      })),
    });

    const totalValue = body.ativos.reduce((sum: number, a: { valor_rs: number }) => sum + a.valor_rs, 0);
    await prisma.relatorio.update({
      where: { id: parseInt(id) },
      data: { valor_total: totalValue },
    });

    return NextResponse.json({ count: ativos.count });
  } catch (error) {
    console.error("POST /api/relatorios/[id]/ativos error:", error);
    return NextResponse.json({ error: "Erro ao salvar ativos" }, { status: 500 });
  }
}
