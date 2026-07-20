import { Message } from '../lib/db/entities/message.entity';
import { MessageRepository } from '../lib/db/repositories/message.repository';
import { ConversationRepository } from '../lib/db/repositories/conversation.repository';
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
}

export class MessageServiceImpl implements MessageService {
  constructor(
    private messageRepo: MessageRepository,
    private conversationRepo: ConversationRepository,
  ) {}

  async editLatest(userId: string, conversationId: string, content: string): Promise<EditLatestResult> {
    if (content.length > 500) throw new Error('Content exceeds 500 character limit')

    const conv = await this.conversationRepo.findById(conversationId, userId)
    if (!conv) throw new NotFoundError('Conversation not found')

    const userMsg = await this.messageRepo.findLatestUserMessage(conversationId, userId)
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

  async append(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
  ): Promise<Message> {
    throw new Error('Not implemented')
  }

  async history(conversationId: string): Promise<Message[]> {
    throw new Error('Not implemented')
  }
}
