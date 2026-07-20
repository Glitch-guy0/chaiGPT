import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { getDatabase } = await import("@/lib/db")
    const { Conversation } = await import("@/lib/db/entities/conversation.entity")

    const db = await getDatabase()
    const conversation = await db.getRepository(Conversation).findOne({
      where: { id },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(conversation)
  } catch (error) {
    console.error("Get conversation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
