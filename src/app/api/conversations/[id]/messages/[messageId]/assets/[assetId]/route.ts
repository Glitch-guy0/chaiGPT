import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { MessageRepositoryImpl } from "@/lib/db/repositories/message.repository";
import { ConversationRepositoryImpl } from "@/lib/db/repositories/conversation.repository";
import { AssetRepositoryImpl } from "@/lib/db/repositories/asset.repository";
import { MessageServiceImpl } from "@/services/message.service";
import { AssetServiceImpl } from "@/services/asset.service.impl";
import { NotFoundError } from "@/lib/errors";
import { getQdrantStore } from "@/lib/vector/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; messageId: string; assetId: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, messageId, assetId } = await params;

    if (!UUID_RE.test(id) || !UUID_RE.test(messageId) || !UUID_RE.test(assetId)) {
      return NextResponse.json({ error: "Invalid UUID" }, { status: 400 });
    }

    const ds = await getDatabase();
    const conversationRepo = new ConversationRepositoryImpl(ds);
    const conversation = await conversationRepo.findById(id, userId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messageRepo = new MessageRepositoryImpl(ds);
    const message = await messageRepo.findByIdInConversation(messageId, id, userId);
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const assetRepo = new AssetRepositoryImpl(ds);
    const assetService = new AssetServiceImpl(assetRepo, getQdrantStore());
    const messageService = new MessageServiceImpl(messageRepo, conversationRepo, assetService);

    await messageService.removeAssetFromMessage(messageId, assetId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Remove asset from message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
