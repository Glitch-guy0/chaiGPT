import { z } from "zod"

// ── Enums ──────────────────────────────────────────────────────────
export const RoleSchema = z.enum(["user", "assistant", "system"])
export type Role = z.infer<typeof RoleSchema>

export const MessageStatusSchema = z.enum(["processing", "complete", "stopped"])

// ── Conversation ───────────────────────────────────────────────────
export const ConversationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  rootConversationId: z.string().uuid().optional(),
  lastMessageId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  model: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Conversation = z.infer<typeof ConversationSchema>

// ── Message ────────────────────────────────────────────────────────
export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  role: RoleSchema,
  content: z.string().min(1),
  model: z.string().optional(),
  status: MessageStatusSchema,
  createdAt: z.date(),
})
export type Message = z.infer<typeof MessageSchema>

// ── Asset ──────────────────────────────────────────────────────────
export const AssetSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  conversationId: z.string().uuid(),
  filename: z.string().min(1),
  mime: z.string().min(1),
  path: z.string().min(1),
  createdAt: z.date(),
})
export type Asset = z.infer<typeof AssetSchema>

// ── Create Conversation Input ──────────────────────────────────────
export const CreateConversationSchema = z.object({
  title: z.string().min(1).max(255).default("New Chat"),
  model: z.string().optional(),
})
export type CreateConversationInput = z.infer<typeof CreateConversationSchema>

// ── Chat Request / Response ────────────────────────────────────────
export const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: RoleSchema,
        content: z.string().min(1).max(500),
      })
    )
    .min(1),
  conversationId: z.string().uuid().optional(),
  model: z.string().optional(),
})
export type ChatRequest = z.infer<typeof ChatRequestSchema>

export const ChatResponseSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  conversationId: z.string().uuid(),
  model: z.string().optional(),
})
export type ChatResponse = z.infer<typeof ChatResponseSchema>

// ── Web Search (LangChain tool contract) ───────────────────────────
export const WebSearchArgsSchema = z.object({
  query: z.string().min(1),
})
export type WebSearchArgs = z.infer<typeof WebSearchArgsSchema>
