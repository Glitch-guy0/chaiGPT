import { z } from 'zod';

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  status: z.enum(["processing", "complete", "stopped"]).optional(),
  model: z.string().optional(),
  createdAt: z.date(),
});

export const ChatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().max(500),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1),
    })
  ).min(1).optional(),
  model: z.string().optional(),
});

export const ConversationSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string(),
  model: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  messages: z.array(MessageSchema).optional(),
});

export const AssetSchema = z.object({
  conversationId: z.string().uuid(),
  filename: z.string(),
  mime: z.string(),
});

export const WebSearchArgsSchema = z.object({
  query: z.string().min(1),
});

export const CreateConversationSchema = z.object({
  title: z.string().min(1).max(255).default("New Chat"),
})

export const ChatResponseSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  conversationId: z.string().uuid(),
  model: z.string().optional(),
})

export type Message = z.infer<typeof MessageSchema>
export type Conversation = z.infer<typeof ConversationSchema>
export type CreateConversationInput = z.infer<typeof CreateConversationSchema>
export type ChatRequest = z.infer<typeof ChatRequestSchema>
export type ChatResponse = z.infer<typeof ChatResponseSchema>
