import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/session"
import { ChatServiceImpl } from "@/services/chat.service"
import { AssetRepositoryImpl } from "@/lib/db/repositories/asset.repository"
import { ConversationRepositoryImpl } from "@/lib/db/repositories/conversation.repository"
import { MessageRepositoryImpl } from "@/lib/db/repositories/message.repository"
import { OpenAiProvider } from "@/lib/ai/langchain"
import { NotFoundError } from "@/lib/errors"
import { ChatRequestSchema } from "@/lib/validation/schemas"
import { getDatabase } from "@/lib/db"
import { ZodError } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = ChatRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      )
    }

    const ds = await getDatabase()
    const conversationRepo = new ConversationRepositoryImpl(ds)
    const messageRepo = new MessageRepositoryImpl(ds)
    const assetRepo = new AssetRepositoryImpl(ds)
    const aiProvider = new OpenAiProvider()

    const chatService = new ChatServiceImpl(
      conversationRepo,
      messageRepo,
      aiProvider,
      assetRepo,
      undefined, // qdrantStore — wire when Story 5.3 lands
      undefined, // redisCache — wire when Story 5.4 lands
    )

    const stream = await chatService.send(parsed.data, userId)

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
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 },
      )
    }
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
