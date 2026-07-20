import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/session"
import { ConversationServiceImpl } from "@/services/conversation.service"
import { ConversationRepositoryImpl } from "@/lib/db/repositories/conversation.repository"
import { MessageRepositoryImpl } from "@/lib/db/repositories/message.repository"
import { NotFoundError } from "@/lib/errors"
import { getDatabase } from "@/lib/db"
import { BranchRequestSchema } from "@/lib/validation/schemas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
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
    const parsed = BranchRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      )
    }

    const ds = await getDatabase()
    const conversationRepo = new ConversationRepositoryImpl(ds)
    const messageRepo = new MessageRepositoryImpl(ds)
    const service = new ConversationServiceImpl(conversationRepo, messageRepo)

    const branch = await service.branch(id, parsed.data.messageId, userId)
    return NextResponse.json(branch, { status: 201 })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof Error && /branch|parentId|assistant/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Branch conversation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
