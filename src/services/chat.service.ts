import type { ChatRequest, ChatMessage, Citation } from '@/types';
import type { AiProvider } from '@/lib/ai/langchain';
import { DEFAULT_MODEL } from '@/lib/ai/langchain';
import type { AssetRepository } from '@/lib/db/repositories/asset.repository';
import type { ConversationRepository } from '@/lib/db/repositories/conversation.repository';
import type { MessageRepository, MessageStatus } from '@/lib/db/repositories/message.repository';
import type { QdrantStore } from '@/lib/vector/qdrant';
import type { RedisCache } from '@/lib/cache/redis';
import { cacheKey, deserializeHits, serializeHits, CACHE_TTL_SECONDS } from '@/lib/cache/redis';
import { NotFoundError } from '@/lib/errors';
import { ChatRequestSchema } from '@/lib/validation/schemas';
import { splitContent } from '@/lib/transforms/content-split';
import type { Conversation } from '@/lib/db/entities/conversation.entity';
import { formatRagContext, hitsToCitations } from '@/lib/rag/inject';
import type { WebSearchTool } from '@/lib/websearch/webSearchTool';

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
    private webSearchTool?: WebSearchTool,
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

    let citations: Citation[] = [];
    let ragDegraded = false;

    if (parsed.conversationId && this.qdrantStore) {
      let hits: import('@/lib/vector/qdrant').Hit[] | null = null;
      const key = cacheKey(parsed.conversationId);

      // Try cache first
      if (this.redisCache) {
        try {
          const cached = await this.redisCache.get(key);
          if (cached) {
            hits = deserializeHits(cached);
            if (hits) {
              console.log(`[Cache] hit for convId=${parsed.conversationId}`);
            }
          }
        } catch (err) {
          console.warn('[Cache] get() failed, falling through to embed+search:', err);
        }
      }

      // Cache miss — embed + search
      if (!hits) {
        try {
          const ragStart = performance.now();
          const vec = await this.qdrantStore.embed(userContent);
          hits = await this.qdrantStore.search(vec, parsed.conversationId, 3);
          const ragLatencyMs = performance.now() - ragStart;

          if (ragLatencyMs > 300) {
            console.error(
              `[RAG] Retrieval exceeded 300ms budget: ${ragLatencyMs.toFixed(1)}ms ` +
              `conversationId=${conversation.id} assetCount=${hits.length}`,
            );
          } else if (ragLatencyMs > 200) {
            console.warn(
              `[RAG] Retrieval approaching budget: ${ragLatencyMs.toFixed(1)}ms ` +
              `conversationId=${conversation.id}`,
            );
          }

          console.log(`[Cache] miss — embedded + searched for convId=${parsed.conversationId}`);

          // Write to cache (fire-and-forget)
          if (this.redisCache) {
            this.redisCache.set(key, serializeHits(hits), CACHE_TTL_SECONDS).catch((err) => {
              console.warn('[Cache] set() failed:', err);
            });
          }
        } catch (err) {
          ragDegraded = true;
          console.error('[RAG] Retrieval failed, proceeding ungrounded:', err);
          hits = [];
        }
      }

      if (hits.length > 0) {
        citations = hitsToCitations(hits);
        const ragContext = formatRagContext(hits);
        if (ragContext) {
          messages.splice(1, 0, {
            role: 'system',
            content: ragContext,
          });
        }
      }
    }

    if (this.webSearchTool) {
      try {
        const webResult = await this.webSearchTool.run({ query: userContent });
        if (
          webResult &&
          !webResult.startsWith('No web search results') &&
          !webResult.startsWith('Web search unavailable')
        ) {
          messages.splice(1, 0, {
            role: 'system',
            content: webResult,
          });
        }
      } catch (err) {
        console.error('[WebSearch] Injection failed:', err);
      }
    }

    return this.createStream(assistantMessage.id, messages, userId, citations, ragDegraded);
  }

  private async createStream(
    assistantMessageId: string,
    messages: ChatMessage[],
    userId: string,
    citations: Citation[] = [],
    ragDegraded = false,
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
              `event: done\ndata: ${JSON.stringify({ id: assistantMessageId, status: 'complete', citations, ragDegraded })}\n\n`,
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

    let citations: Citation[] = [];
    let ragDegraded = false;

    if (this.qdrantStore && history.length > 0) {
      const lastUserMsg = [...history].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        let hits: import('@/lib/vector/qdrant').Hit[] | null = null;
        const key = cacheKey(message.conversationId);

        if (this.redisCache) {
          try {
            const cached = await this.redisCache.get(key);
            if (cached) hits = deserializeHits(cached);
          } catch { /* fall through */ }
        }

        if (!hits) {
          try {
            const vec = await this.qdrantStore.embed(lastUserMsg.content);
            hits = await this.qdrantStore.search(vec, message.conversationId, 3);
            if (this.redisCache) {
              this.redisCache.set(key, serializeHits(hits), CACHE_TTL_SECONDS).catch(() => {});
            }
          } catch {
            ragDegraded = true;
            hits = [];
          }
        }

        if (hits && hits.length > 0) {
          citations = hitsToCitations(hits);
          const ragContext = formatRagContext(hits);
          if (ragContext) {
            messages.splice(1, 0, { role: 'system', content: ragContext });
          }
        }
      }
    }

    return this.createStream(messageId, messages, userId, citations, ragDegraded);
  }
}
