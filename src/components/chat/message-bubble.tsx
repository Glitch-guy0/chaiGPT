"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AssetReferences } from "@/components/chat/asset-references"
import { StreamingMessage } from "@/components/chat/streaming-message"
import { MessageControls } from "@/components/chat/message-controls"
import { EditMessageInput } from "@/components/chat/edit-message-input"
import { cn } from "@/lib/utils"
import type { Message } from "@/types/chat"

interface MessageBubbleProps {
  message: Message
  isEditing?: boolean
  onRemoveAsset?: (assetId: string) => void
  isStreaming?: boolean
  isLatestUser?: boolean
  onEdit?: (messageId: string) => void
  onRegenerate?: (messageId: string) => void
  onBranch?: (messageId: string) => void
  isRegenerating?: boolean
  isEditMode?: boolean
  editContent?: string
  onSaveEdit?: (messageId: string, content: string) => void
  onCancelEdit?: () => void
  isEditSubmitting?: boolean
}

export function MessageBubble({
  message,
  isEditing = false,
  onRemoveAsset,
  isStreaming = false,
  isLatestUser = false,
  onEdit,
  onRegenerate,
  onBranch,
  isRegenerating = false,
  isEditMode = false,
  editContent,
  onSaveEdit,
  onCancelEdit,
  isEditSubmitting = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user"
  const hasAssets = !isUser && message.assetIds && message.assetIds.length > 0

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser ? "bg-background" : "bg-muted/50",
        isEditing && "opacity-50",
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs">
          {isUser ? "U" : "AI"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold">
            {isUser ? "You" : "Assistant"}
          </span>
        </div>
        {isEditMode && isUser ? (
          <EditMessageInput
            initialContent={editContent ?? message.content}
            onSubmit={(content) => onSaveEdit?.(message.id, content)}
            onCancel={() => onCancelEdit?.()}
            isSubmitting={isEditSubmitting}
          />
        ) : (
          <StreamingMessage
            content={message.content}
            isStreaming={isStreaming}
            status={message.status}
            citations={message.citations}
          />
        )}
        {hasAssets && (
          <AssetReferences
            assetIds={message.assetIds!}
            removable={isEditing}
            onRemove={onRemoveAsset}
          />
        )}
        {onEdit && onRegenerate && (
          <div className="mt-1">
            <MessageControls
              messageId={message.id}
              role={message.role}
              status={message.status}
              isLatestUser={isLatestUser}
              onEdit={onEdit}
              onRegenerate={onRegenerate}
              onBranch={onBranch}
              isLoading={isRegenerating}
            />
          </div>
        )}
      </div>
    </div>
  )
}
