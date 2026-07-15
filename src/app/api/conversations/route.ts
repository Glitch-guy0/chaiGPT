import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { getDatabase } = await import("@/lib/db")
    const { Conversation } = await import("@/lib/db/entities/conversation.entity")

    const db = await getDatabase()
    const conversations = await db.getRepository(Conversation).find({
      order: { updatedAt: "DESC" },
      take: 50,
    })
    return NextResponse.json(conversations)
  } catch (error) {
    console.error("Get conversations error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST() {
  try {
    const { getDatabase } = await import("@/lib/db")
    const { Conversation } = await import("@/lib/db/entities/conversation.entity")

    const db = await getDatabase()
    const repo = db.getRepository(Conversation)
    const conversation = repo.create({
      title: "New Chat",
    })
    const saved = await repo.save(conversation)
    return NextResponse.json(saved, { status: 201 })
  } catch (error) {
    console.error("Create conversation error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
