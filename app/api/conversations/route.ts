import { NextResponse } from "next/server"
import type { Conversation } from "@/types/chat"

const mockConversations: Conversation[] = []

export async function GET() {
  return NextResponse.json(mockConversations)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      title: body.title || "New Chat",
      messages: [],
      createdAt: new Date(),
    }
    mockConversations.push(conversation)
    return NextResponse.json(conversation)
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
