import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatMessage } from '@/types';

const mockInvoke = vi.fn();
const mockStream = vi.fn();

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class {
    invoke = mockInvoke;
    stream = mockStream;
  },
}));

const { OpenAiProvider, DEFAULT_MODEL } = await import('./langchain');

describe('module exports', () => {
  it('DEFAULT_MODEL is gpt-4o-mini', () => {
    expect(DEFAULT_MODEL).toBe('gpt-4o-mini');
  });

  it('OpenAiProvider is a class', () => {
    expect(typeof OpenAiProvider).toBe('function');
  });
});

describe('OpenAiProvider', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  });

  describe('interface conformance', () => {
    it('has complete and streamChat methods matching AiProvider', () => {
      const provider = new OpenAiProvider();
      expect(provider).toBeInstanceOf(OpenAiProvider);
      expect(typeof provider.complete).toBe('function');
      expect(typeof provider.streamChat).toBe('function');
      expect(provider.complete.length).toBe(1);
      expect(provider.streamChat.length).toBe(2);
    });
  });

  describe('constructor', () => {
    it('throws when OPENAI_API_KEY is missing', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => new OpenAiProvider()).toThrow(
        'OPENAI_API_KEY environment variable is required',
      );
    });

    it('accepts optional model name', () => {
      const provider = new OpenAiProvider('gpt-4');
      expect(provider).toBeInstanceOf(OpenAiProvider);
    });


  });

  describe('streamChat', () => {
    it('calls onChunk with expected tokens and resolves', async () => {
      mockStream.mockReturnValue(
        (async function* () {
          yield { content: 'Hello ' };
          yield { content: 'world' };
        })(),
      );

      const provider = new OpenAiProvider();
      const onChunk = vi.fn();
      const messages: ChatMessage[] = [{ role: 'user', content: 'Hi' }];

      await provider.streamChat(messages, onChunk);

      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello ');
      expect(onChunk).toHaveBeenNthCalledWith(2, 'world');
    });

    it('handles non-string content gracefully', async () => {
      mockStream.mockReturnValue(
        (async function* () {
          yield { content: ['not', 'a', 'string'] };
        })(),
      );

      const provider = new OpenAiProvider();
      const onChunk = vi.fn();
      const messages: ChatMessage[] = [{ role: 'user', content: 'Hi' }];

      await provider.streamChat(messages, onChunk);

      expect(onChunk).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('returns the joined string from AI response', async () => {
      mockInvoke.mockResolvedValue({ content: 'Hello world' });

      const provider = new OpenAiProvider();
      const messages: ChatMessage[] = [{ role: 'user', content: 'Hi' }];

      const result = await provider.complete(messages);

      expect(result).toBe('Hello world');
    });

    it('returns empty string for non-string content', async () => {
      mockInvoke.mockResolvedValue({ content: ['foo', 'bar'] });

      const provider = new OpenAiProvider();
      const messages: ChatMessage[] = [{ role: 'user', content: 'Hi' }];

      const result = await provider.complete(messages);

      expect(result).toBe('');
    });
  });
});
