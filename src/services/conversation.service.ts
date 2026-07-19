import { Conversation } from "@/lib/db/entities/conversation.entity"
import { ConversationRepository } from "@/lib/db/repositories/conversation.repository"

export const DEFAULT_MODEL = "gpt-4o-mini"

export interface CreateConversationInput {
  title: string
  model?: string
}

export interface ConversationService {
  list(userId: string): Promise<Conversation[]>
  create(userId: string, input: CreateConversationInput): Promise<Conversation>
  getById(id: string, userId: string): Promise<Conversation | null>
  branch(id: string, messageId: string, userId: string): Promise<Conversation>
}

export class ConversationServiceImpl implements ConversationService {
  constructor(private readonly repo: ConversationRepository) {}

  async list(userId: string): Promise<Conversation[]> {
    return this.repo.findAll(userId)
  }

  async create(userId: string, input: CreateConversationInput): Promise<Conversation> {
    const conversation = new Conversation()
    conversation.userId = userId
    conversation.title = input.title
    conversation.model = input.model ?? DEFAULT_MODEL
    conversation.status = "active"
    return this.repo.save(conversation)
  }

  async getById(id: string, userId: string): Promise<Conversation | null> {
    return this.repo.findById(id, userId)
  }

  async branch(_id: string, _messageId: string, _userId: string): Promise<Conversation> {
    throw new Error("branch() not yet implemented — Story 4.1")
  }
}
