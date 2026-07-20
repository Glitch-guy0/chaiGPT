import { Message } from '../lib/db/entities/message.entity';
import { MessageRepository } from '../lib/db/repositories/message.repository';
import { generateId } from '../lib/utils';

export interface IMessageService {
  append(conversationId: string, userId: string, content: string): Promise<Message>;
  editLatest(userId: string, conversationId: string, content: string): Promise<Message>;
}

export class MessageService implements IMessageService {
  private repo = new MessageRepository();

  async append(conversationId: string, userId: string, content: string, isPasted: boolean = false): Promise<Message> {
    let finalContent = content;

    if (isPasted && content.length > 200) {
      // In a real app we'd inject AssetService or call it here
      const { AssetService } = require('./asset.service');
      const assetService = new AssetService();
      const asset = await assetService.createFromText(userId, conversationId, content, 'pasted-snippet.txt');
      finalContent = `[Attached Asset: ${asset.filename}]`;
    } else if (content.length > 500) {
      const { AssetService } = require('./asset.service');
      const assetService = new AssetService();
      const asset = await assetService.createFromText(userId, conversationId, content, 'long-message.txt');
      finalContent = `[Attached Asset: ${asset.filename}]`;
    }

    const msg = new Message();
    msg.id = generateId();
    msg.conversationId = conversationId;
    msg.userId = userId;
    msg.content = finalContent;
    msg.role = 'user';
    msg.status = 'complete';
    return this.repo.save(msg);
  }

  async editLatest(userId: string, conversationId: string, content: string): Promise<Message> {
    const messages = await this.repo.findByConversation(conversationId, userId);
    if (!messages || messages.length === 0) {
      throw new Error('No messages found');
    }

    // Find the last message (already sorted by createdAt ASC in repo)
    const latestMsg = messages[messages.length - 1];

    // To edit the user message, it might be the latest, or the one before the latest assistant message
    let latestUserMsg = null;
    let latestAssistantMsg = null;

    if (latestMsg.role === 'user') {
      latestUserMsg = latestMsg;
    } else if (latestMsg.role === 'assistant' && messages.length > 1) {
      const prevMsg = messages[messages.length - 2];
      if (prevMsg.role === 'user') {
        latestUserMsg = prevMsg;
        latestAssistantMsg = latestMsg;
      }
    }

    if (!latestUserMsg) {
      throw new Error('Could not determine the latest user message to edit');
    }

    // Ensure it's not branched - we can assume if it's the latest, it's the leaf for now
    // according to the story requirements. Because branches create new conversations,
    // siblings or children of older messages are not in this conversation array at all.

    latestUserMsg.content = content;
    await this.repo.save(latestUserMsg);

    // If there is a trailing assistant reply, we clear it so it can be regenerated or just leave it.
    // Spec says: "only that message and its trailing assistant reply are updated content-only with the same IDs"
    if (latestAssistantMsg) {
      latestAssistantMsg.content = '';
      latestAssistantMsg.status = 'processing';
      await this.repo.save(latestAssistantMsg);
    }

    return latestUserMsg;
  }
}
