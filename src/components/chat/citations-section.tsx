"use client"

import type { Citation } from "@/types"

interface CitationsSectionProps {
  citations: Citation[]
}

export function CitationsSection({ citations }: CitationsSectionProps) {
  if (!citations || citations.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">Sources</p>
      <ul className="space-y-1.5">
        {citations.map((citation, idx) => (
          <li key={citation.chunkId ?? idx} className="text-xs">
            {citation.url ? (
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {citation.title ?? `Source ${idx + 1}`}
              </a>
            ) : (
              <span className="text-muted-foreground">
                {citation.title ?? `Source ${idx + 1}`}
              </span>
            )}
            {citation.snippet && (
              <p className="text-muted-foreground mt-0.5 line-clamp-2">
                {citation.snippet}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
