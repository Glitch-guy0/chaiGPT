"use client"

import { useState, useCallback, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { SignInButton, useAuth } from "@clerk/nextjs"
import { Sidebar } from "@/components/chat/sidebar"
import { ChatWindow } from "@/components/chat/chat-window"
import { useChat } from "@/hooks/use-chat"
import { Button } from "@/components/ui/button"
import { RotateCcw, Loader2 } from "lucide-react"
import type { Message, Conversation } from "@/types/chat"

function LoadingSkeleton() {
  return (
    <div className="flex h-screen w-full">
      <div className="w-60 border-r border-border bg-muted/30 p-3 space-y-3">
        <div className="h-10 bg-muted rounded-md animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col p-4 space-y-4">
        <div className="h-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-24 bg-muted rounded-lg animate-pulse" />
        <div className="h-16 bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  )
}

function SignInPrompt() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <h1 className="text-2xl font-semibold text-foreground">chaiGPT</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to start chatting
        </p>
        <SignInButton mode="modal">
          <Button size="lg">Sign In</Button>
        </SignInButton>
      </div>
    </div>
  )
}

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
}

function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 bg-destructive/10 border-b border-destructive/20 text-sm text-destructive">
      <span>{message}</span>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="gap-1 shrink-0">
          <RotateCcw className="h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  )
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          Could not load your conversations. Please try again.
        </p>
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  )
}

async function fetchConversationMessages(conversationId: string, signal?: AbortSignal): Promise<{ conversation: Conversation; messages: Message[] }> {
  const res = await fetch(`/api/conversations/${conversationId}`, { signal })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`)
  }
  return res.json()
}

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const chatMutation = useChat()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState<string | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleNewChat = useCallback(() => {
    setConversation(null)
    setMessages([])
    setError(null)
  }, [])

  const handleSelectConversation = useCallback(async (id: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setMessagesLoading(true)
    setError(null)
    try {
      const data = await fetchConversationMessages(id, controller.signal)
      if (controller.signal.aborted) return
      setConversation(data.conversation)
      setMessages(data.messages)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : "Failed to load conversation")
    } finally {
      if (!controller.signal.aborted) {
        setMessagesLoading(false)
      }
    }
  }, [])

  const handleSend = useCallback(
    async (content: string) => {
      if (messagesLoading) return

      const currentConvId = conversation?.id
      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversationId: currentConvId || crypto.randomUUID(),
        role: "user",
        content,
        createdAt: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])

      try {
        const response = await chatMutation.mutateAsync({
          messages: [...(currentConvId === conversation?.id ? messages : []), userMessage],
          conversationId: currentConvId,
        })

        const assistantMessage: Message = {
          id: response.id,
          conversationId: response.conversationId,
          role: "assistant",
          content: response.content,
          createdAt: new Date(),
        }

        setMessages((prev) => [...prev, assistantMessage])
        setConversation((prev: Conversation | null) =>
          prev && prev.id === response.conversationId
            ? prev
            : {
                id: response.conversationId,
                title: content.slice(0, 50),
                createdAt: new Date(),
                updatedAt: new Date(),
              }
        )
      } catch {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          conversationId: currentConvId || crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          createdAt: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    },
    [messages, conversation, chatMutation, messagesLoading]
  )

  const handleRetry = useCallback(() => {
    setConversation(null)
    setMessages([])
    setError(null)
    queryClient.invalidateQueries({ queryKey: ["conversations"] })
  }, [queryClient])

  if (!isLoaded) return <LoadingSkeleton />

  if (!isSignedIn) return <SignInPrompt />

  if (error && messages.length === 0) {
    return <ErrorFallback onRetry={handleRetry} />
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar
        activeConversationId={conversation?.id ?? null}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
      />
      <div className="flex-1 flex flex-col min-h-0">
        {error && <ErrorBanner message={error} onRetry={handleRetry} />}
        <ChatWindow
          messages={messages}
          onSend={handleSend}
          isLoading={chatMutation.isPending || messagesLoading}
          conversationId={conversation?.id}
        />
      </div>
    </div>
  )
}
