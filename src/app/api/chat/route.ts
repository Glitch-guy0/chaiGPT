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
import { getRedisClient, RedisClient } from "@/lib/cache/redis"
import { getQdrantStore } from "@/lib/vector/qdrant"
import { DefaultWebSearchTool } from "@/lib/websearch/webSearchTool"
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
    console.log("[Chat API] Received POST /api/chat request body:", JSON.stringify(body, null, 2))

    const parsed = ChatRequestSchema.safeParse(body)

    if (!parsed.success) {
      console.error("[Chat API] 400 Bad Request — Zod validation failed:", JSON.stringify(parsed.error.issues, null, 2))
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

    let redisCache: RedisClient | undefined;
    try {
      const redis = getRedisClient();
      redisCache = new RedisClient(redis);
    } catch {
      console.warn("[Chat] Redis unavailable — falling back to uncached RAG");
    }

    const chatService = new ChatServiceImpl(
      conversationRepo,
      messageRepo,
      aiProvider,
      assetRepo,
      getQdrantStore(),
      redisCache,
      new DefaultWebSearchTool(),
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
