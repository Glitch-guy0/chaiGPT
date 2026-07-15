import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { getDatabase } = await import("@/lib/db")
    const { Conversation } = await import("@/lib/db/entities/conversation.entity")
    const { Message } = await import("@/lib/db/entities/message.entity")
    const { langChainService } = await import("@/lib/ai/langchain")
    const { ChatRequestSchema } = await import("@/lib/validation/schemas")

    await getDatabase()

    const validation = ChatRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      )
    }

    const { messages: incomingMessages, model, conversationId } = validation.data
    const db = await getDatabase()
    const conversationRepo = db.getRepository(Conversation)
    const messageRepo = db.getRepository(Message)

    let conversation: ReturnType<typeof conversationRepo.create> | null = null

    if (conversationId) {
      conversation = await conversationRepo.findOne({
        where: { id: conversationId },
      })
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
      }
    } else {
      conversation = conversationRepo.create({
        title: incomingMessages[0]?.content.slice(0, 50) || "New Chat",
      })
      conversation = await conversationRepo.save(conversation)
    }

    const lastUserMessage = incomingMessages[incomingMessages.length - 1]
    const userMessage = messageRepo.create({
      conversationId: conversation.id,
      role: "user" as const,
      content: lastUserMessage.content,
    })
    await messageRepo.save(userMessage)

    const allMessages = await messageRepo.find({
      where: { conversationId: conversation.id },
      order: { createdAt: "ASC" },
    })

    const langchainMessages = allMessages.map((msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    }))

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const assistantContent = await langChainService.complete(langchainMessages)

          const assistantMessage = messageRepo.create({
            conversationId: conversation!.id,
            role: "assistant" as const,
            content: assistantContent,
            model,
          })
          await messageRepo.save(assistantMessage)

          const responseData = {
            id: crypto.randomUUID(),
            content: assistantContent,
            conversationId: conversation!.id,
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(responseData)}\n\n`)
          )
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch (error) {
          console.error("Stream error:", error)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
