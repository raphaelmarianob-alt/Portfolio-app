import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
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

    return NextResponse.json(relatorio);
  } catch (error) {
    console.error("GET /api/relatorios/[id] error:", error);
    return NextResponse.json({ error: "Erro ao buscar relatório" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.relatorio.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/relatorios/[id] error:", error);
    return NextResponse.json({ error: "Erro ao excluir relatório" }, { status: 500 });
  }
}
