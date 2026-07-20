import { NextResponse } from "next/server";
import { ChatRequestSchema } from "../../../lib/validation/schemas";
import { auth } from "../../../lib/auth/session";
import { ChatService } from "../../../services/chat.service";
import { ConversationService } from "../../../services/conversation.service";
import { langChainService } from "../../../lib/ai/langchain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth.session();
    const body = await req.json();

    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
    }

    let convId = parsed.data.conversationId;
    if (!convId) {
      const convService = new ConversationService();
      const conv = await convService.create(session.userId, { title: parsed.data.content.substring(0, 50) });
      convId = conv.id;
    }

    const chatService = new ChatService();

    // Support client abort
    const abortController = new AbortController();
    req.signal.addEventListener('abort', () => abortController.abort());

    const stream = await chatService.send({ ...parsed.data, conversationId: convId }, session.userId, langChainService, abortController.signal);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 500 });
  }
}
