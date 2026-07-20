import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/session"
import { MessageServiceImpl } from "@/services/message.service"
import { MessageRepositoryImpl } from "@/lib/db/repositories/message.repository"
import { ConversationRepositoryImpl } from "@/lib/db/repositories/conversation.repository"
import { NotFoundError } from "@/lib/errors"
import { getDatabase } from "@/lib/db"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EditSchema = z.object({
  content: z.string().min(1).max(500),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = EditSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      )
    }

    const ds = await getDatabase()
    const messageRepo = new MessageRepositoryImpl(ds)
    const conversationRepo = new ConversationRepositoryImpl(ds)
    const service = new MessageServiceImpl(messageRepo, conversationRepo)

    const result = await service.editLatest(userId, id, parsed.data.content)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error("Edit message error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
