"use client"

export function StreamingIndicator() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Generating response">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "150ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "300ms" }} />
    </span>
  )
}
