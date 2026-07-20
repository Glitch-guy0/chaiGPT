import { z } from 'zod';
import type { Role, ChatMessage, ChatRequest } from '@/types';

export const RoleSchema: z.ZodType<Role> = z.enum(['user', 'assistant', 'system']);

export const ChatMessageSchema: z.ZodType<ChatMessage> = z.object({
  role: RoleSchema,
  content: z.string().min(1).max(10000),
});

export const ChatRequestSchema: z.ZodType<ChatRequest> = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  model: z.string().optional(),
  conversationId: z.string().uuid().optional(),
});

export const ConversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  model: z.string().optional(),
});

export const CreateConversationSchema = z.object({
  title: z.string().min(1).max(255).default('New Chat'),
  model: z.string().optional(),
});

export const AssetSchema = z.object({
  filename: z.string().min(1),
  mime: z.string().min(1),
  conversationId: z.string().uuid(),
});

export const WebSearchArgsSchema = z.object({
  query: z.string().min(1),
});

export type WebSearchArgs = z.infer<typeof WebSearchArgsSchema>;
