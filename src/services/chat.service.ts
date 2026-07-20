import type { ChatRequest, ChatMessage } from '@/types';
import type { AiProvider } from '@/lib/ai/langchain';
import { DEFAULT_MODEL } from '@/lib/ai/langchain';
import type { AssetRepository } from '@/lib/db/repositories/asset.repository';
import type { ConversationRepository } from '@/lib/db/repositories/conversation.repository';
import type { MessageRepository, MessageStatus } from '@/lib/db/repositories/message.repository';
import type { QdrantStore } from '@/lib/vector/qdrant';
import type { RedisCache } from '@/lib/cache/redis';
import { NotFoundError } from '@/lib/errors';
import { ChatRequestSchema } from '@/lib/validation/schemas';
import { splitContent } from '@/lib/transforms/content-split';
import type { Conversation } from '@/lib/db/entities/conversation.entity';

export type { ChatRequest, ChatMessage };

export interface ChatService {
  send(req: ChatRequest, userId: string): Promise<ReadableStream>;
  stream(req: ChatRequest, onChunk: (token: string) => void): Promise<void>;
  regenerate(messageId: string, userId: string): Promise<ReadableStream>;
}

export class ChatServiceImpl implements ChatService {
  constructor(
    private conversationRepo: ConversationRepository,
    private messageRepo: MessageRepository,
    private aiProvider: AiProvider,
    private assetRepo?: AssetRepository,
    private qdrantStore?: QdrantStore,
    private redisCache?: RedisCache,
  ) {}

  async send(req: ChatRequest, userId: string): Promise<ReadableStream> {
    const parsed = ChatRequestSchema.parse(req);

    let conversation: Conversation;
    if (parsed.conversationId) {
      const found = await this.conversationRepo.findById(parsed.conversationId, userId);
      if (!found) throw new NotFoundError('Conversation not found');
      conversation = found;
    } else {
      conversation = await this.conversationRepo.save({
        userId,
        title: parsed.messages[0].content.slice(0, 50) || 'New Chat',
        model: parsed.model ?? DEFAULT_MODEL,
      });
    }

    const lastUserMsg = parsed.messages[parsed.messages.length - 1];
    const split = splitContent(lastUserMsg.content);
    const userContent = split.inline;

    const assetIds: string[] = [];
    if (split.extracted.length > 0 && this.assetRepo) {
      for (let i = 0; i < split.extracted.length; i++) {
        const asset = await this.assetRepo.save({
          userId,
          conversationId: conversation.id,
          filename: `pasted-${Date.now()}-${i}.txt`,
          mime: 'text/plain',
          path: `assets/pasted-${Date.now()}-${i}.txt`,
          text: split.extracted[i],
        });
        assetIds.push(asset.id);
      }
    }

    await this.messageRepo.save({
      conversationId: conversation.id,
      userId,
      role: 'user',
      content: userContent,
      status: 'complete' as MessageStatus,
      assetIds: assetIds.length > 0 ? assetIds : undefined,
    });

    const assistantMessage = await this.messageRepo.save({
      conversationId: conversation.id,
      userId,
      role: 'assistant',
      content: '',
      status: 'processing' as MessageStatus,
      model: parsed.model,
    });

    const history = await this.messageRepo.findByConversation(conversation.id, userId);

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...history.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    if (parsed.conversationId && this.qdrantStore) {
      try {
        const vec = await this.qdrantStore.embed(userContent);
        const hits = await this.qdrantStore.search(vec, parsed.conversationId, 3);
        if (hits.length > 0) {
          const context = hits.map(h => h.text).join('\n');
          messages.splice(1, 0, {
            role: 'system',
            content: `Relevant context:\n${context}`,
          });
        }
      } catch {
        // graceful degradation — stream still proceeds without RAG
      }
    }

    return this.createStream(assistantMessage.id, messages, userId);
  }

  private async createStream(
    assistantMessageId: string,
    messages: ChatMessage[],
    userId: string,
  ): Promise<ReadableStream> {
    const encoder = new TextEncoder();
    let buffer = '';
    let done = false;
    let streamController: ReadableStreamDefaultController | null = null;

    const stream = new ReadableStream({
      start: async (controller) => {
        streamController = controller;
        try {
          await this.aiProvider.streamChat(messages, (token: string) => {
            if (done) return;
            buffer += token;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`),
            );
          });

          if (done) return;
          done = true;
          await this.messageRepo.save({
            id: assistantMessageId,
            content: buffer,
            status: 'complete' as MessageStatus,
            userId,
          });

          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({ id: assistantMessageId, status: 'complete' })}\n\n`,
            ),
          );
          controller.close();
        } catch {
          if (done) return;
          done = true;
          await this.messageRepo.updateStatus(assistantMessageId, 'stopped' as MessageStatus, userId);
          await this.messageRepo.save({
            id: assistantMessageId,
            content: 'user terminated the response',
            userId,
          });

          controller.enqueue(
            encoder.encode(
              `event: stopped\ndata: ${JSON.stringify({ id: assistantMessageId, status: 'stopped' })}\n\n`,
            ),
          );
          controller.close();
        }
      },
      cancel: async () => {
        if (done) return;
        done = true;
        try {
          await this.messageRepo.updateStatus(assistantMessageId, 'stopped' as MessageStatus, userId);
          await this.messageRepo.save({
            id: assistantMessageId,
            content: 'user terminated the response',
            userId,
          });
          if (streamController) {
            streamController.enqueue(
              encoder.encode(
                `event: stopped\ndata: ${JSON.stringify({ id: assistantMessageId, status: 'stopped' })}\n\n`,
              ),
            );
          }
        } catch {
          // best-effort
        }
      },
    });

    return stream;
  }

  async stream(req: ChatRequest, onChunk: (token: string) => void): Promise<void> {
    const parsed = ChatRequestSchema.parse(req);
    await this.aiProvider.streamChat(parsed.messages, onChunk);
  }

  async regenerate(messageId: string, userId: string): Promise<ReadableStream> {
    const message = await this.messageRepo.findById(messageId, userId);
    if (!message) throw new NotFoundError('Message not found');

    const started = await this.messageRepo.tryStartRegenerate(messageId, userId);
    if (!started) {
      throw new Error('Can only regenerate stopped assistant messages');
    }

    const history = message.parentId
      ? await this.messageRepo.findMessageChain(message.conversationId, message.parentId, userId)
      : [];

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...history.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    return this.createStream(messageId, messages, userId);
  }
}
