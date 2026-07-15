"use client"

import { useConversations } from "@/hooks/use-conversations"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, MessageSquare } from "lucide-react"

export function Sidebar() {
  const { conversations, isLoading, createConversation } = useConversations()

  const handleNewChat = () => {
    createConversation("New Chat")
  }

  return (
    <div className="w-60 border-r border-border flex flex-col bg-muted/30">
      <div className="p-3">
        <Button
          onClick={handleNewChat}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
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
                variant="ghost"
                className="w-full justify-start gap-2 h-auto py-2 px-3"
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
