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
    const conversation = await db.getRepository(Conversation).findOne({
      where: { id, userId },
      relations: {
        messages: true,
      },
      order: { messages: { createdAt: "ASC" } },
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
