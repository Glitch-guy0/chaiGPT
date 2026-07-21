import { Message } from '../lib/db/entities/message.entity';
import { Conversation } from '../lib/db/entities/conversation.entity';
import { MessageRepository } from '../lib/db/repositories/message.repository';
import { ConversationRepository } from '../lib/db/repositories/conversation.repository';
import type { AssetService } from './asset.service';
import { NotFoundError } from '../lib/errors';

export type EditLatestResult = { userMessage: Message; assistantMessage: Message };

export interface MessageService {
  append(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
  ): Promise<Message>;
  history(conversationId: string): Promise<Message[]>;
  editLatest(userId: string, conversationId: string, content: string): Promise<EditLatestResult>;
  removeAssetFromMessage(messageId: string, assetId: string, userId: string): Promise<void>;
}

export class MessageServiceImpl implements MessageService {
  constructor(
    private messageRepo: MessageRepository,
    private conversationRepo: ConversationRepository,
    private assetService?: AssetService,
  ) {}

  async editLatest(userId: string, conversationId: string, content: string): Promise<EditLatestResult> {
    if (content.length > 500) throw new Error('Content exceeds 500 character limit')

    const conv = await this.conversationRepo.findById(conversationId, userId)
    if (!conv) throw new NotFoundError('Conversation not found')

    const userMsg = await this.resolveTargetUserMessage(conv, userId, conversationId)
    if (!userMsg) throw new NotFoundError('No user messages found')

    userMsg.content = content
    const userMessage = await this.messageRepo.save(userMsg)

    const assistantMsg = await this.messageRepo.findTrailingAssistantMessage(conversationId, userMsg.id, userId)
    let assistantMessage: Message
    if (assistantMsg) {
      assistantMsg.content = ''
      assistantMessage = await this.messageRepo.save(assistantMsg)
    } else {
      assistantMessage = { ...userMsg, id: '', role: 'assistant' as const, content: '' } as Message
    }

    return { userMessage, assistantMessage }
  }

  private async isBranchedAway(siblingId: string, userId: string, conversationId: string): Promise<boolean> {
    const children = await this.messageRepo.findByParentId(siblingId, userId)
    return children.some((c) => c.conversationId !== conversationId)
  }

  private async resolveTargetUserMessage(
    conv: Conversation,
    userId: string,
    conversationId: string,
  ): Promise<Message | null> {
    let target: Message | null = null

    if (conv.lastMessageId) {
      const lastMsg = await this.messageRepo.findByIdInConversation(conv.lastMessageId, conversationId, userId)
      if (lastMsg) {
        const parentId = lastMsg.role === 'user'
          ? lastMsg.parentId
          : (lastMsg.parentId ? (await this.messageRepo.findByIdInConversation(lastMsg.parentId, conversationId, userId))?.parentId : undefined)
        if (parentId) {
          const siblings = await this.messageRepo.findSiblingsByParentId(parentId, conversationId, userId)
          const userSiblings = siblings
            .filter((m) => m.role === 'user')
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
          target = userSiblings[0] ?? null
        }
      }
    }

    if (!target) {
      target = await this.messageRepo.findLatestUserMessage(conversationId, userId)
    }
    if (!target) return null

    if (!target.parentId) return target

    const latestSibling = await this.messageRepo.findLatestSibling(target.parentId, conversationId, userId)
    if (latestSibling && latestSibling.id !== target.id) {
      throw new Error('Can only edit the most recent sibling')
    }

    if (await this.isBranchedAway(target.id, userId, conversationId)) {
      throw new Error('Cannot edit a message that has been branched from')
    }

    return target
  }

  async append(
    _conversationId: string,
    _role: 'user' | 'assistant' | 'system',
    _content: string
  ): Promise<Message> {
    throw new Error('Not implemented')
  }

  async history(_conversationId: string): Promise<Message[]> {
    throw new Error('Not implemented')
  }

  async removeAssetFromMessage(messageId: string, assetId: string, userId: string): Promise<void> {
    const msg = await this.messageRepo.findById(messageId, userId)
    if (!msg) throw new NotFoundError('Message not found')

    if (!msg.assetIds?.includes(assetId)) {
      throw new NotFoundError('Asset not found on this message')
    }

    await this.messageRepo.removeAssetId(messageId, assetId, userId)

    if (this.assetService) {
      try {
        await this.assetService.remove(assetId, userId)
      } catch (err) {
        console.warn(`[MessageService] Asset removal failed for ${assetId} after message update:`, err)
      }
    }
  }
}
