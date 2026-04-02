import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const ativo = await prisma.researchBase.update({
      where: { id: parseInt(id) },
      data: body,
    });
    return NextResponse.json(ativo);
  } catch (error) {
    console.error("PATCH /api/research/[id] error:", error);
    return NextResponse.json({ error: "Erro ao atualizar ativo" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.researchBase.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/research/[id] error:", error);
    return NextResponse.json({ error: "Erro ao remover ativo" }, { status: 500 });
  }
}
