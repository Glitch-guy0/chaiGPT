"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { MessageBubble } from "@/components/chat/message-bubble"
import { ChatInput } from "@/components/chat/chat-input"
import { AssetPanel } from "@/components/chat/asset-panel"
import type { Message } from "@/types/chat"

interface ChatWindowProps {
  messages: Message[]
  onSend: (content: string) => void
  conversationId?: string
  isLoading?: boolean
  editingMessageId?: string | null
  onToggleEdit?: (messageId: string | null) => void
  streamingMessageId?: string | null
  onSaveEdit?: (messageId: string, content: string) => void
  onRegenerate?: (messageId: string) => void
  regeneratingMessageId?: string | null
  onEditClick?: (messageId: string) => void
  onEditCancel?: () => void
  isEditSubmitting?: boolean
}

export function ChatWindow({
  messages,
  onSend,
  conversationId,
  isLoading,
  editingMessageId: editingMessageIdProp,
  onToggleEdit,
  streamingMessageId,
  onSaveEdit,
  onRegenerate,
  regeneratingMessageId,
  onEditClick,
  onEditCancel,
  isEditSubmitting,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(
    editingMessageIdProp ?? null,
  )
  const [localMessages, setLocalMessages] = useState<Message[]>(messages)

  useEffect(() => {
    setLocalMessages(messages)
  }, [messages])

  useEffect(() => {
    if (editingMessageIdProp !== undefined) {
      setEditingMessageId(editingMessageIdProp)
    }
  }, [editingMessageIdProp])

  const contentHash = localMessages.map((m) => `${m.id}:${m.content.length}:${m.status}`).join(",")

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [localMessages.length, contentHash])

  const lastUserIdx = (() => {
    for (let i = localMessages.length - 1; i >= 0; i--) {
      if (localMessages[i].role === "user") return i
    }
    return -1
  })()

  const isLatestMessage =
    editingMessageId !== null &&
    lastUserIdx >= 0 &&
    localMessages[lastUserIdx]?.id === editingMessageId

  const handleRemoveAsset = useCallback(
    async (messageId: string, assetId: string) => {
      const prevAssetIds = localMessages.find((m) => m.id === messageId)?.assetIds

      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, assetIds: (m.assetIds ?? []).filter((a: string) => a !== assetId) }
            : m,
        ),
      )

      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/messages/${messageId}/assets/${assetId}`,
          { method: "DELETE" },
        )
        if (!res.ok) throw new Error("Failed to remove asset")
      } catch {
        setLocalMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, assetIds: prevAssetIds } : m,
          ),
        )
        toast.error("Failed to remove asset. Please try again.")
      }
    },
    [localMessages, conversationId],
  )

  const handleEditClick = useCallback(
    (messageId: string) => {
      setEditingMessageId(messageId)
      onEditClick?.(messageId)
    },
    [onEditClick],
  )

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null)
    onEditCancel?.()
  }, [onEditCancel])

  const handleSaveEdit = useCallback(
    (messageId: string, content: string) => {
      onSaveEdit?.(messageId, content)
    },
    [onSaveEdit],
  )

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div className="flex-1 overflow-y-auto" data-chat>
        <div className="max-w-3xl mx-auto">
          {localMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center py-32">
              <p className="text-muted-foreground text-sm">
                Start a conversation
              </p>
            </div>
          ) : (
            <>
              {localMessages.map((message, idx) => {
                const isAssistantEditing =
                  message.role === "assistant" &&
                  idx === lastUserIdx + 1 &&
                  isLatestMessage

                const isStreamingMsg =
                  message.id === streamingMessageId ||
                  (message.role === "assistant" &&
                    message.status === "processing" &&
                    idx === localMessages.length - 1)

                const isEditModeActive =
                  editingMessageId !== null &&
                  message.id === editingMessageId

                const isRegenerating =
                  regeneratingMessageId !== null &&
                  message.id === regeneratingMessageId

                const isLatestUserMessage =
                  message.role === "user" && idx === lastUserIdx

                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isEditing={isAssistantEditing}
                    isStreaming={isStreamingMsg}
                    onRemoveAsset={
                      isAssistantEditing
                        ? (assetId) => handleRemoveAsset(message.id, assetId)
                        : undefined
                    }
                    isLatestUser={isLatestUserMessage}
                    onEdit={handleEditClick}
                    onRegenerate={onRegenerate}
                    isRegenerating={isRegenerating}
                    isEditMode={isEditModeActive}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleEditCancel}
                    isEditSubmitting={isEditSubmitting}
                  />
                )
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>
      <AssetPanel conversationId={conversationId} />
      <ChatInput
        onSend={onSend}
        disabled={isLoading}
        conversationId={conversationId}
      />
    </div>
  )
}
