"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { FileText, Trash2, X } from "lucide-react"

export function AssetManager({ conversationId, onUpload }: { conversationId?: string, onUpload: (file: File) => void }) {
  const [assets, setAssets] = useState<any[]>([])

  // In a real app we'd fetch these from an API

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/assets/${id}`, { method: 'DELETE' });
      setAssets(assets.filter(a => a.id !== id));
    } catch (e) {
      console.error(e);
    }
  }

  if (!conversationId) return null;

  return (
    <div className="flex gap-2 p-4 border-b border-border bg-muted/20 overflow-x-auto">
      {assets.map(asset => (
        <div key={asset.id} className="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-1.5 text-sm shrink-0">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="truncate max-w-[150px]">{asset.filename}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => handleDelete(asset.id)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}
