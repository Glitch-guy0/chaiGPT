"use client"

import { UserButton } from "@clerk/nextjs"
import { useConversations } from "@/hooks/use-conversations"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, MessageSquare } from "lucide-react"

interface SidebarProps {
  activeConversationId?: string | null
  onSelectConversation?: (id: string) => void
  onNewChat?: () => void
}

export function Sidebar({ activeConversationId, onSelectConversation, onNewChat }: SidebarProps) {
  const { conversations, isLoading } = useConversations()

  const handleNewChat = () => {
    onNewChat?.()
  }

  return (
    <div className="w-60 border-r border-border flex flex-col bg-muted/30" data-sidebar>
      <div className="p-3 flex items-center justify-between gap-2">
        <Button
          onClick={handleNewChat}
          className="flex-1 justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
        <UserButton />
      </div>
      <ScrollArea className="flex-1 px-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded-md animate-pulse" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground px-2 py-4">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conv) => (
              <Button
                key={conv.id}
                variant={activeConversationId === conv.id ? "secondary" : "ghost"}
                className="w-full justify-start gap-2 h-auto py-2 px-3"
                data-conversation-id={conv.id}
                onClick={() => onSelectConversation?.(conv.id)}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm">{conv.title}</span>
              </Button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
