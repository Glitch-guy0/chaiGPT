import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationService } from './conversation.service';

// Mock dependencies
const mockConversationRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  save: vi.fn((c) => Promise.resolve(c))
};

const mockMessageRepo = {
  findByConversation: vi.fn(),
  save: vi.fn((m) => Promise.resolve(m))
};

vi.mock('../lib/db/repositories/conversation.repository', () => {
  return {
    ConversationRepository: class {
      constructor() {
        return mockConversationRepo;
      }
    }
  };
});

vi.mock('../lib/db/repositories/message.repository', () => {
  return {
    MessageRepository: class {
      constructor() {
        return mockMessageRepo;
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

vi.mock('../lib/utils', () => ({
  generateId: vi.fn().mockReturnValue('mock-id'),
}));

describe('ConversationService', () => {
  let service: ConversationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConversationService();
  });

  it('should branch a conversation', async () => {
    const parentId = 'conv-1';
    const messageId = 'msg-2';
    const userId = 'user-1';

    // Mock parent conversation
    const mockParentConv = {
      id: parentId,
      userId,
      title: 'Chat',
      model: 'gpt-4o-mini',
      rootConversationId: 'root-1'
    };
    mockConversationRepo.findById.mockResolvedValue(mockParentConv);

    // Mock messages
    const mockMessages = [
      { id: 'msg-1', role: 'user', content: 'hello', parentId: null },
      { id: 'msg-2', role: 'assistant', content: 'hi there', parentId: 'msg-1' },
      { id: 'msg-3', role: 'user', content: 'next', parentId: 'msg-2' }
    ];

    mockMessageRepo.findByConversation.mockResolvedValue(mockMessages);

    const result = await service.branch(parentId, messageId, userId);

    expect(result.title).toBe('Chat (Branch)');
    expect(result.rootConversationId).toBe('root-1');
    expect(mockMessageRepo.findByConversation).toHaveBeenCalledWith(parentId, userId);

    // It should have saved 2 messages (up to the branch point msg-2)
    expect(mockMessageRepo.save).toHaveBeenCalledTimes(2);

    const firstSaveCall = mockMessageRepo.save.mock.calls[0][0];
    expect(firstSaveCall.content).toBe('hello');
    expect(firstSaveCall.role).toBe('user');
    expect(firstSaveCall.parentId).toBe(null);

    const secondSaveCall = mockMessageRepo.save.mock.calls[1][0];
    expect(secondSaveCall.content).toBe('hi there');
    expect(secondSaveCall.role).toBe('assistant');
  });

  it('should throw error if message not found', async () => {
    mockConversationRepo.findById.mockResolvedValue({});

    mockMessageRepo.findByConversation.mockResolvedValue([]);

    await expect(service.branch('c', 'm', 'u')).rejects.toThrow('Message not found in conversation');
  });

  it('should throw error if branching from non-assistant message', async () => {
    mockConversationRepo.findById.mockResolvedValue({});

    mockMessageRepo.findByConversation.mockResolvedValue([
      { id: 'm', role: 'user' }
    ]);

    await expect(service.branch('c', 'm', 'u')).rejects.toThrow('Branching is only supported from assistant messages');
  });
});
