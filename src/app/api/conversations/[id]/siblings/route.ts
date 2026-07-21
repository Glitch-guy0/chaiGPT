import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { getDatabase } = await import("@/lib/db")
    const { Conversation } = await import("@/lib/db/entities/conversation.entity")

    const db = await getDatabase()
    const repo = db.getRepository(Conversation)

    const conversation = await repo.findOne({
      where: { id, userId },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const rootId = conversation.rootConversationId || conversation.id

    const siblings = await repo.find({
      where: [
        { rootConversationId: rootId, userId },
        { id: rootId, userId },
      ],
      order: { updatedAt: "DESC" },
      take: 50,
    })

    return NextResponse.json(siblings)
  } catch (error) {
    console.error("Get siblings error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
