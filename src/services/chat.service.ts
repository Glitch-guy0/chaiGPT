import { ChatRequest } from '../lib/validation/schemas';
import { ConversationRepository } from '../lib/db/repositories/conversation.repository';
import { MessageRepository } from '../lib/db/repositories/message.repository';
import { Message } from '../lib/db/entities/message.entity';
import { IAiProvider } from '../lib/ai/provider';
import { generateId } from '../lib/utils';

export interface IChatService {
  send(req: ChatRequest, userId: string, aiProvider: IAiProvider, signal?: AbortSignal): Promise<ReadableStream>;
  regenerate(messageId: string, userId: string, aiProvider: IAiProvider, signal?: AbortSignal): Promise<ReadableStream>;
}

export class ChatService implements IChatService {
  private convRepo = new ConversationRepository();
  private msgRepo = new MessageRepository();

  async send(req: ChatRequest, userId: string, aiProvider: IAiProvider, signal?: AbortSignal): Promise<ReadableStream> {
    const convId = req.conversationId;
    if (!convId) {
      // should have been created if undefined, but schema allows optional
      throw new Error('conversationId required');
    }

    // 1. Save user message using MessageService to handle limits
    const { MessageService } = require('./message.service');
    const msgService = new MessageService();
    // Assuming we can pass a flag if it's pasted, for now hardcode false.
    // In real app, ChatRequestSchema needs a flag for pasted content.
    await msgService.append(convId, userId, req.content, false);

    // Update conversation lastMessageId
    // In a real app we'd fetch the conversation and update it.

    // 2. Create trailing assistant message
    const asstMsg = new Message();
    asstMsg.id = generateId();
    asstMsg.conversationId = convId;
    asstMsg.userId = userId;
    asstMsg.role = 'assistant';
    asstMsg.content = '';
    asstMsg.status = 'processing';
    asstMsg.model = req.model || 'gpt-4o-mini';
    await this.msgRepo.save(asstMsg);

    const history = await this.msgRepo.findByConversation(convId, userId);

    // Retrieve context from Cache or Qdrant
    const { qdrantStore } = require('../lib/vector/qdrant');
    const { redisCache } = require('../lib/cache/redis');
    const cacheKey = `rag:context:${convId}`;

    let contextText = await redisCache.get(cacheKey);

    if (!contextText) {
      const vec = await qdrantStore.embed(req.content);
      const chunks = await qdrantStore.search(vec, convId, 3);

      if (chunks.length > 0) {
        contextText = chunks.map((c: any) => c.text).join('\n\n');
        await redisCache.set(cacheKey, contextText, 300); // 5 mins TTL
      }
    }

    if (contextText) {
      const systemMsg = new Message();
      systemMsg.role = 'system';
      systemMsg.content = `Use the following retrieved context from your documents to help answer the user:\n\n${contextText}`;
      history.unshift(systemMsg);
    }

    const encoder = new TextEncoder();
    const self = this;
    return new ReadableStream({
      async start(controller) {
        let buffer = '';
        let isTerminated = false;

        const onChunk = (chunk: string) => {
          if (signal?.aborted) return;
          buffer += chunk;
          const data = { id: asstMsg.id, content: buffer };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          signal?.addEventListener('abort', () => {
            isTerminated = true;
          });

          await aiProvider.streamChat(history, onChunk);

          if (signal?.aborted || isTerminated) {
            asstMsg.content = 'user terminated the response';
            asstMsg.status = 'stopped';
            await self.msgRepo.save(asstMsg);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id: asstMsg.id, content: asstMsg.content })}\n\n`));
          } else {
            asstMsg.content = buffer;
            asstMsg.status = 'complete';
            await self.msgRepo.save(asstMsg);
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err: any) {
           asstMsg.status = 'stopped';
           await self.msgRepo.save(asstMsg);
           controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
           controller.close();
        }
      }
    });
  }

  async regenerate(messageId: string, userId: string, aiProvider: IAiProvider, signal?: AbortSignal): Promise<ReadableStream> {
    const asstMsg = await this.msgRepo.findById(messageId, userId);
    if (!asstMsg) {
      throw new Error('Message not found');
    }
    if (asstMsg.role !== 'assistant') {
      throw new Error('Only assistant messages can be regenerated');
    }
    if (asstMsg.status !== 'stopped') {
      throw new Error('Only stopped messages can be regenerated');
    }

    asstMsg.status = 'processing';
    asstMsg.content = '';
    await this.msgRepo.save(asstMsg);

    const historyAll = await this.msgRepo.findByConversation(asstMsg.conversationId, userId);

    // Build prompt from history up to this point
    const history: Message[] = [];
    for (const m of historyAll) {
      if (m.id === asstMsg.id) break;
      history.push(m);
    }

    const encoder = new TextEncoder();
    const self = this;
    return new ReadableStream({
      async start(controller) {
        let buffer = '';
        let isTerminated = false;

        const onChunk = (chunk: string) => {
          if (signal?.aborted) return;
          buffer += chunk;
          const data = { id: asstMsg.id, content: buffer };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          signal?.addEventListener('abort', () => {
            isTerminated = true;
          });

          await aiProvider.streamChat(history, onChunk);

          if (signal?.aborted || isTerminated) {
            asstMsg.content = 'user terminated the response';
            asstMsg.status = 'stopped';
            await self.msgRepo.save(asstMsg);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id: asstMsg.id, content: asstMsg.content })}\n\n`));
          } else {
            asstMsg.content = buffer;
            asstMsg.status = 'complete';
            await self.msgRepo.save(asstMsg);
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err: any) {
           asstMsg.status = 'stopped';
           await self.msgRepo.save(asstMsg);
           controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
           controller.close();
        }
      }
    });
  }
}
