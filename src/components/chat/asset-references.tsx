"use client"

import { FileText, File, X } from "lucide-react"
import { useAssetMetadata } from "@/hooks/use-asset-metadata"

interface AssetReferencesProps {
  assetIds: string[]
  removable: boolean
  onRemove?: (assetId: string) => void
}

function iconForMime(mime: string) {
  if (mime === "application/pdf") return <FileText className="h-3.5 w-3.5" />
  if (mime.startsWith("text/")) return <FileText className="h-3.5 w-3.5" />
  return <File className="h-3.5 w-3.5" />
}

export function AssetReferences({ assetIds, removable, onRemove }: AssetReferencesProps) {
  const { meta } = useAssetMetadata(assetIds)

  if (!assetIds || assetIds.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {assetIds.map((id) => {
        const m = meta[id]
        const label = m?.filename ?? id.slice(0, 8)
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium"
          >
            {m && iconForMime(m.mime)}
            <span className="max-w-[140px] truncate">{label}</span>
            {removable && onRemove && (
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                aria-label={`Remove ${label}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}
