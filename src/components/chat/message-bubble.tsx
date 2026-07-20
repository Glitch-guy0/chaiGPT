"use client"

import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Edit2, RefreshCcw, X, Check } from "lucide-react"
import type { Message } from "@/types/chat"
import { MarkdownRenderer } from "./markdown-renderer"

interface MessageBubbleProps {
  message: Message
  isLatestUserMessage?: boolean
  onEdit?: (id: string, newContent: string) => void
  onRegenerate?: (id: string) => void
}

export function MessageBubble({ message, isLatestUserMessage, onEdit, onRegenerate }: MessageBubbleProps) {
  const isUser = message.role === "user"
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  const handleSave = () => {
    if (onEdit && editContent.trim() !== message.content) {
      onEdit(message.id, editContent)
    }
    setIsEditing(false)
  }

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
        <div className="flex items-baseline justify-between gap-2 mb-1 group">
          <span className="text-sm font-semibold">
            {isUser ? "You" : "Assistant"}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isUser && isLatestUserMessage && !isEditing && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
            {!isUser && message.status === 'stopped' && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRegenerate?.(message.id)}>
                <RefreshCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {isUser ? (
            isEditing ? (
              <div className="flex flex-col gap-2 mt-2">
                <Textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Check className="h-3 w-3 mr-1" /> Save
                  </Button>
                </div>
              </div>
            ) : (
              message.content
            )
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
      </div>
    </div>
  )
}
