"use client"

import { Button } from "@/components/ui/button"
import { Pencil, RotateCcw, Loader2, GitFork } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MessageStatus, Role } from "@/types/chat"

interface MessageControlsProps {
  messageId: string
  role: Role
  status?: MessageStatus
  isLatestUser: boolean
  onEdit: (messageId: string) => void
  onRegenerate: (messageId: string) => void
  onBranch?: (messageId: string) => void
  isLoading?: boolean
}

export function MessageControls({
  messageId,
  role,
  status,
  isLatestUser,
  onEdit,
  onRegenerate,
  onBranch,
  isLoading,
}: MessageControlsProps) {
  const isUser = role === "user"
  const isStopped = status === "stopped"
  const showRegenerate = !isUser && isStopped

  if (isLoading) {
    return (
      <div className="flex gap-1" role="status">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled
          aria-label="Loading"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-1">
      {isUser && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6",
            !isLatestUser && "opacity-30 cursor-not-allowed",
          )}
          disabled={!isLatestUser}
          onClick={() => onEdit(messageId)}
          aria-label="Edit message"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      )}
      {showRegenerate && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onRegenerate(messageId)}
          aria-label="Regenerate response"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      )}
      {onBranch && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onBranch(messageId)}
          aria-label="Branch conversation"
          title="Branch conversation from here"
        >
          <GitFork className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
