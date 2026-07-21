"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { StreamingIndicator } from "@/components/chat/streaming-indicator"
import { CitationsSection } from "@/components/chat/citations-section"
import type { Citation } from "@/types"

interface StreamingMessageProps {
  content: string
  isStreaming?: boolean
  status?: "processing" | "complete" | "stopped"
  citations?: Citation[]
}

export function StreamingMessage({
  content,
  isStreaming = false,
  status,
  citations,
}: StreamingMessageProps) {
  const showIndicator = isStreaming && content.length === 0
  const showEmptyComplete = !isStreaming && content.length === 0 && status === "complete"
  const showStoppedFallback = status === "stopped" && content.length === 0

  return (
    <div role="status" aria-live={isStreaming ? "polite" : "off"} data-streaming={isStreaming ? "true" : undefined}>
      {showIndicator && <StreamingIndicator />}

      {showEmptyComplete && (
        <p className="text-sm text-muted-foreground italic">[Empty response]</p>
      )}

      {showStoppedFallback && (
        <p className="text-sm text-muted-foreground italic">
          User terminated the response
        </p>
      )}

      {content.length > 0 && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      )}

      {citations && citations.length > 0 && <CitationsSection citations={citations} />}

      {status === "complete" && content.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">Complete</p>
      )}

      {status === "stopped" && content.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">Stopped</p>
      )}
    </div>
  )
}
