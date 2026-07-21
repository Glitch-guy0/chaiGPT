"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { FileText, File, Trash2, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

interface Asset {
  id: string
  filename: string
  mime: string
  createdAt: string
}

interface AssetPanelProps {
  conversationId?: string
  activeAssetIds?: string[]
}

async function fetchAssets(conversationId: string): Promise<Asset[]> {
  const res = await fetch(`/api/assets?conversationId=${encodeURIComponent(conversationId)}`, {
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to fetch assets")
  return res.json() as Promise<Asset[]>
}

function iconForMime(mime: string) {
  if (mime === "application/pdf") return <FileText className="h-4 w-4" />
  if (mime.startsWith("text/")) return <FileText className="h-4 w-4" />
  return <File className="h-4 w-4" />
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function AssetPanel({ conversationId, activeAssetIds }: AssetPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: assets, isLoading, isError, refetch } = useQuery({
    queryKey: ["assets", conversationId],
    queryFn: () => fetchAssets(conversationId!),
    enabled: !!conversationId,
  })

  const handleDelete = async (assetId: string) => {
    setDeletingId(assetId)
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete asset")
      queryClient.invalidateQueries({ queryKey: ["assets", conversationId] })
      toast.success("Asset deleted")
    } catch {
      toast.error("Failed to delete asset. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  if (!conversationId) {
    return (
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">Send a message to start</p>
      </div>
    )
  }

  const assetCount = assets?.length ?? 0

  return (
    <div className="border-t border-border">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 h-auto text-sm text-muted-foreground hover:text-foreground rounded-none"
        aria-label={expanded ? "Collapse assets" : `Assets (${assetCount})`}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <FileText className="h-4 w-4" />
        <span>Assets ({assetCount})</span>
      </Button>

      {expanded && (
        <div className="px-2 pb-2 max-h-48 overflow-y-auto">
          {isLoading && (
            <div className="space-y-2 px-2 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))}
            </div>
          )}

          {isError && (
            <div className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-destructive text-xs">Failed to load assets</span>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs h-7">
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !isError && assets && assets.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-2">No assets yet</p>
          )}

          {!isLoading && !isError && assets && assets.length > 0 && (
            <div className="space-y-0.5">
              {assets.map((asset) => (
                <AlertDialog key={asset.id}>
                  <div className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 rounded-md group">
                    {iconForMime(asset.mime)}
                    <span className="flex-1 truncate max-w-[180px]">{asset.filename}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelativeDate(asset.createdAt)}
                    </span>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Delete ${asset.filename}`}
                        disabled={deletingId === asset.id}
                      >
                        {deletingId === asset.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete asset</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {asset.filename}? This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(asset.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </div>
                </AlertDialog>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
