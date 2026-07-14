import { NextResponse } from "next/server"
import type { ChatRequest, ChatResponse, Message } from "@/types/chat"

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json()
    const lastMessage = body.messages[body.messages.length - 1]

    const responseMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Echo: ${lastMessage.content}`,
      createdAt: new Date(),
    }

    const response: ChatResponse = {
      id: crypto.randomUUID(),
      content: responseMessage.content,
      conversationId: crypto.randomUUID(),
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
