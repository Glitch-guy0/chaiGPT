import { Conversation } from '../lib/db/entities/conversation.entity'
import { ConversationRepository } from '../lib/db/repositories/conversation.repository'
import { CreateConversationSchema } from '../lib/validation/schemas'
import { DEFAULT_MODEL } from '../lib/ai/langchain'
import { NotFoundError } from '../lib/errors'
import { z } from 'zod'

export interface ConversationService {
  list(userId: string): Promise<Conversation[]>
  create(
    userId: string,
    input: { title?: string; model?: string }
  ): Promise<Conversation>
  getById(id: string, userId: string): Promise<Conversation | null>
  branch(id: string, messageId: string, userId: string): Promise<Conversation>
}

export class ConversationServiceImpl implements ConversationService {
  constructor(private repo: ConversationRepository) {}

  async list(userId: string): Promise<Conversation[]> {
    const conversations = await this.repo.findAll(userId)
    return conversations
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 50)
  }

  async create(
    userId: string,
    input: { title?: string; model?: string }
  ): Promise<Conversation> {
    const parsed = CreateConversationSchema.parse(input)
    const conversation: Partial<Conversation> = {
      userId,
      title: parsed.title,
      model: parsed.model ?? DEFAULT_MODEL,
    }
    return this.repo.save(conversation)
  }

  async getById(id: string, userId: string): Promise<Conversation> {
    const conversation = await this.repo.findById(id, userId)
    if (!conversation) {
      throw new NotFoundError('Conversation not found')
    }
    return conversation
  }

  async branch(_id: string, _messageId: string, _userId: string): Promise<Conversation> {
    throw new Error('branch not yet implemented')
  }
}
