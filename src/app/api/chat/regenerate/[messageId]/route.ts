import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/session"
import { ChatServiceImpl } from "@/services/chat.service"
import { ConversationRepositoryImpl } from "@/lib/db/repositories/conversation.repository"
import { MessageRepositoryImpl } from "@/lib/db/repositories/message.repository"
import { OpenAiProvider } from "@/lib/ai/langchain"
import { NotFoundError } from "@/lib/errors"
import { getDatabase } from "@/lib/db"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { messageId } = await params
    const ds = await getDatabase()
    const chatService = new ChatServiceImpl(
      new ConversationRepositoryImpl(ds),
      new MessageRepositoryImpl(ds),
      new OpenAiProvider(),
    )

    const stream = await chatService.regenerate(messageId, userId)
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof Error && error.message.includes('Can only regenerate')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Regenerate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
