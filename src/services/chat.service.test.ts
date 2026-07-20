import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatService } from './chat.service';

const mockMsgRepo = {
  findById: vi.fn(),
  findByConversation: vi.fn(),
  save: vi.fn((m) => Promise.resolve(m))
};

vi.mock('../lib/db/repositories/conversation.repository', () => {
  return {
    ConversationRepository: vi.fn()
  };
});

vi.mock('../lib/db/repositories/message.repository', () => {
  return {
    MessageRepository: class {
      constructor() {
        return mockMsgRepo;
      }
    }
  };
});

vi.mock('../lib/db/entities/message.entity', () => ({
  Message: class {
    id!: string;
    conversationId!: string;
    userId!: string;
    role!: string;
    content!: string;
    status!: string;
    model!: string;
    parentId!: string | null;
  }
}));

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChatService();
  });

  describe('regenerate', () => {
    it('should overwrite stopped message within branch and stream', async () => {
      const mockAsstMsg = {
        id: 'msg-3',
        conversationId: 'conv-branch-1',
        userId: 'user-1',
        role: 'assistant',
        content: 'failed midway',
        status: 'stopped'
      };

      const mockHistory = [
        { id: 'msg-1', role: 'user', content: 'hello' },
        { id: 'msg-2', role: 'assistant', content: 'hi' },
        mockAsstMsg // id: msg-3
      ];

      mockMsgRepo.findById.mockResolvedValue(mockAsstMsg);
      mockMsgRepo.findByConversation.mockResolvedValue(mockHistory);

      const mockAiProvider = {
        streamChat: vi.fn(async (history, onChunk) => {
          onChunk('chunk 1');
          onChunk(' chunk 2');
        })
      };

      const stream = await service.regenerate('msg-3', 'user-1', mockAiProvider as any);

      const reader = stream.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(new TextDecoder().decode(value));
      }

      // Check it overwritten
      expect(mockAsstMsg.status).toBe('complete');
      expect(mockAsstMsg.content).toBe('chunk 1 chunk 2');
      expect(mockMsgRepo.save).toHaveBeenCalled();

      // Since it's in place, it does not branch. Same message ID reused.
      expect(chunks.some(c => c.includes('"content":"chunk 1"'))).toBe(true);
      expect(chunks.some(c => c.includes('"content":"chunk 1 chunk 2"'))).toBe(true);
      expect(chunks[chunks.length - 1]).toContain('data: [DONE]');
    });

    it('should throw if regenerating a non-stopped message', async () => {
       const mockAsstMsg = {
        id: 'msg-3',
        conversationId: 'conv-branch-1',
        userId: 'user-1',
        role: 'assistant',
        content: 'complete reply',
        status: 'complete' // not stopped
      };

      mockMsgRepo.findById.mockResolvedValue(mockAsstMsg);

      await expect(service.regenerate('msg-3', 'user-1', {} as any)).rejects.toThrow('Only stopped messages can be regenerated');
    });
  });
});
