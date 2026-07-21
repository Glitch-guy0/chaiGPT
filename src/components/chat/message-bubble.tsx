"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AssetReferences } from "@/components/chat/asset-references"
import type { Message } from "@/types/chat"

interface MessageBubbleProps {
  message: Message
  isEditing?: boolean
  onRemoveAsset?: (assetId: string) => void
}

export function MessageBubble({ message, isEditing = false, onRemoveAsset }: MessageBubbleProps) {
  const isUser = message.role === "user"
  const hasAssets = !isUser && message.assetIds && message.assetIds.length > 0

  return (
    <div
      className={`flex gap-3 px-4 py-3 ${
        isUser ? "bg-background" : "bg-muted/50"
      }`}
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
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
        {hasAssets && (
          <AssetReferences
            assetIds={message.assetIds!}
            removable={isEditing}
            onRemove={onRemoveAsset}
          />
        )}
      </div>
    </div>
  )
}
