import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search") || "";
    const orderBy = req.nextUrl.searchParams.get("orderBy") || "ticker";
    const order = req.nextUrl.searchParams.get("order") || "asc";

    const where = search
      ? {
          OR: [
            { ticker: { contains: search } },
            { setor: { contains: search } },
            { nome_empresa: { contains: search } },
          ],
        }
      : {};

    const ativos = await prisma.researchBase.findMany({
      where,
      orderBy: { [orderBy]: order },
    });

    return NextResponse.json(ativos ?? []);
  } catch (error) {
    console.error("GET /api/research error:", error);
    return NextResponse.json({ error: "Erro ao buscar ativos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ativo = await prisma.researchBase.create({ data: body });
    return NextResponse.json(ativo, { status: 201 });
  } catch (error) {
    console.error("POST /api/research error:", error);
    return NextResponse.json({ error: "Erro ao criar ativo" }, { status: 500 });
  }
}
