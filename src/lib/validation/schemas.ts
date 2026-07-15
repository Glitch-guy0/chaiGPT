import { z } from "zod"

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  model: z.string().optional(),
  createdAt: z.date(),
})

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255),
  model: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  messages: z.array(MessageSchema).optional(),
})

export const CreateConversationSchema = z.object({
  title: z.string().min(1).max(255).default("New Chat"),
})

export const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1),
    })
  ).min(1),
  model: z.string().optional(),
  conversationId: z.string().uuid().optional(),
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
