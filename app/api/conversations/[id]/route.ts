import { NextResponse } from "next/server"
import type { Conversation } from "@/types/chat"

const mockConversations: Conversation[] = []

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const conversation = mockConversations.find((c) => c.id === id)
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(conversation)
}
