import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: "Not Implemented" }, { status: 501 });
}

export async function POST() {
  return NextResponse.json({ error: "Not Implemented" }, { status: 501 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Not Implemented" }, { status: 501 });
}
