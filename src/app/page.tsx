"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { SignInButton, useAuth } from "@clerk/nextjs"
import { Sidebar } from "@/components/chat/sidebar"
import { ChatWindow } from "@/components/chat/chat-window"
import { useChat, useStreamingChat } from "@/hooks/use-chat"
import { useEditMessage } from "@/hooks/use-edit-message"
import { useRegenerateMessage } from "@/hooks/use-regenerate-message"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"
import type { Message, Conversation, MessageStatus } from "@/types/chat"
import type { Citation } from "@/types"

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
  const data = await res.json()
  const messages = data.messages ?? []
  const { messages: _, ...conv } = data
  return { conversation: conv, messages }
}

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const chatMutation = useChat()
  const { streamState, startStream, stopStream, resetStream } = useStreamingChat()
  const editMutation = useEditMessage()
  const { state: regenerateState, regenerate: runRegenerate, reset: resetRegenerate } = useRegenerateMessage()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState<string | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamingMsgIdRef = useRef<string | null>(null)

  useEffect(() => {
    const { content, isStreaming, status, citations, assistantMessageId } = streamState

    const targetId = assistantMessageId || streamingMsgIdRef.current
    if (!targetId && !isStreaming) return

    if (!isStreaming && (status === "complete" || status === "stopped")) {
      setMessages((prev) => {
        const idToUpdate = assistantMessageId || streamingMsgIdRef.current
        if (!idToUpdate) return prev
        const idx = prev.findIndex((m) => m.id === idToUpdate)
        if (idx < 0) return prev
        const updated = [...prev]
        updated[idx] = { ...updated[idx], content, status, citations: citations as Citation[] | undefined }
        return updated
      })

      if (streamState.conversationId) {
        setConversation((prev: Conversation | null) =>
          prev && prev.id === streamState.conversationId
            ? prev
            : {
                id: streamState.conversationId!,
                title: "New Chat",
                createdAt: new Date(),
                updatedAt: new Date(),
              }
        )
      }

      streamingMsgIdRef.current = null
      return
    }

    if (isStreaming && streamingMsgIdRef.current) {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === streamingMsgIdRef.current)
        if (idx < 0) return prev
        const updated = [...prev]
        updated[idx] = { ...updated[idx], content }
        return updated
      })
    }
  }, [streamState])

  useEffect(() => {
    if (!regeneratingMessageId) return
    if (regenerateState.isStreaming) {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === regeneratingMessageId)
        if (idx < 0) return prev
        const updated = [...prev]
        updated[idx] = { ...updated[idx], content: regenerateState.content, status: regenerateState.status }
        return updated
      })
    } else if (!regenerateState.isStreaming && (regenerateState.status === "complete" || regenerateState.status === "stopped")) {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === regeneratingMessageId)
        if (idx < 0) return prev
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          content: regenerateState.content,
          status: regenerateState.status,
        }
        return updated
      })
      setRegeneratingMessageId(null)
    }
  }, [regenerateState, regeneratingMessageId])

  useEffect(() => {
    if (conversation?.id) {
      setEditingMessageId(null)
      setRegeneratingMessageId(null)
    }
  }, [conversation?.id])

  const handleNewChat = useCallback(() => {
    resetStream()
    resetRegenerate()
    setConversation(null)
    setMessages([])
    setError(null)
    setEditingMessageId(null)
    setRegeneratingMessageId(null)
  }, [resetStream, resetRegenerate])

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
      if (messagesLoading || streamState.isStreaming || regeneratingMessageId) return

      const currentConvId = conversation?.id
      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversationId: currentConvId || crypto.randomUUID(),
        role: "user",
        content,
        status: "complete" as MessageStatus,
        createdAt: new Date(),
      }

      const assistantId = crypto.randomUUID()
      streamingMsgIdRef.current = assistantId

      const assistantMessage: Message = {
        id: assistantId,
        conversationId: currentConvId || crypto.randomUUID(),
        role: "assistant",
        content: "",
        status: "processing" as MessageStatus,
        createdAt: new Date(),
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])

      const msgsForApi = currentConvId === conversation?.id ? messages : []
      startStream([...msgsForApi, userMessage], currentConvId)
    },
    [messages, conversation, startStream, messagesLoading, streamState.isStreaming, regeneratingMessageId],
  )

  const handleRetry = useCallback(() => {
    setConversation(null)
    setMessages([])
    setError(null)
    queryClient.invalidateQueries({ queryKey: ["conversations"] })
  }, [queryClient])

  const handleEditClick = useCallback((messageId: string) => {
    setEditingMessageId(messageId)
  }, [])

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null)
  }, [])

  const handleEditSave = useCallback(
    async (messageId: string, content: string) => {
      if (!conversation?.id) return

      try {
        const result = await editMutation.mutateAsync({
          conversationId: conversation.id,
          content,
        })

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === result.userMessage.id) {
              return { ...m, content: result.userMessage.content }
            }
            if (m.id === result.assistantMessage.id) {
              return { ...m, content: result.assistantMessage.content }
            }
            return m
          }),
        )

        setEditingMessageId(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to edit message")
      }
    },
    [conversation?.id, editMutation],
  )

  const handleRegenerate = useCallback(
    (messageId: string) => {
      setRegeneratingMessageId(messageId)
      runRegenerate(messageId)
    },
    [runRegenerate],
  )

  const handleBranch = useCallback(
    async (messageId: string) => {
      const convId = conversation?.id || messages.find((m) => m.id === messageId)?.conversationId
      if (!convId) return
      try {
        const res = await fetch(`/api/conversations/${convId}/branch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Failed to branch conversation")
        }
        const branchedConv: Conversation = await res.json()
        queryClient.invalidateQueries({ queryKey: ["conversations"] })
        await handleSelectConversation(branchedConv.id)
        toast.success("Created new conversation branch!")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to branch conversation")
      }
    },
    [conversation?.id, messages, queryClient, handleSelectConversation],
  )

  const isStreaming = streamState.isStreaming

  if (!isLoaded) return <LoadingSkeleton />

  if (!isSignedIn) return <SignInPrompt />

  if (error && messages.length === 0) {
    return <ErrorFallback onRetry={handleRetry} />
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar
        activeConversationId={conversation?.id ?? null}
        rootConversationId={conversation?.rootConversationId ?? null}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
      />
      <div className="flex-1 flex flex-col min-h-0">
        {error && <ErrorBanner message={error} onRetry={handleRetry} />}
        <ChatWindow
          messages={messages}
          onSend={handleSend}
          isLoading={chatMutation.isPending || messagesLoading || isStreaming || regeneratingMessageId !== null}
          conversationId={conversation?.id}
          streamingMessageId={streamingMsgIdRef.current}
          editingMessageId={editingMessageId}
          onEditClick={handleEditClick}
          onEditCancel={handleEditCancel}
          onSaveEdit={handleEditSave}
          onRegenerate={handleRegenerate}
          onBranch={handleBranch}
          regeneratingMessageId={regeneratingMessageId}
        />
      </div>
    </div>
  )
}
