import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { getDatabase } = await import("@/lib/db")
    const { Conversation } = await import("@/lib/db/entities/conversation.entity")

    const db = await getDatabase()
    const conversations = await db.getRepository(Conversation).find({
      where: { userId },
      order: { updatedAt: "DESC" },
      take: 50,
    })
    console.log(`[Conversations API] Fetched ${conversations.length} conversations for userId=${userId}`)
    return NextResponse.json(conversations)
  } catch (error) {
    console.error("Get conversations error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    const { getDatabase } = await import("@/lib/db")
    const { Conversation } = await import("@/lib/db/entities/conversation.entity")

    const db = await getDatabase()
    const repo = db.getRepository(Conversation)
    const conversation = repo.create({
      userId,
      title: body?.title || "New Chat",
    })
    const saved = await repo.save(conversation)
    return NextResponse.json(saved, { status: 201 })
  } catch (error) {
    console.error("Create conversation error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
