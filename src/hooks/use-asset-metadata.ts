"use client"

import { useEffect, useState } from "react"

export interface AssetMeta {
  id: string
  filename: string
  mime: string
}

export function useAssetMetadata(assetIds: string[]) {
  const [meta, setMeta] = useState<Record<string, AssetMeta>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (assetIds.length === 0) return

    let cancelled = false
    setLoading(true)

    fetch(`/api/assets?ids=${assetIds.map(encodeURIComponent).join(",")}`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch assets")
        return res.json() as Promise<AssetMeta[]>
      })
      .then((assets) => {
        if (cancelled) return
        const map: Record<string, AssetMeta> = {}
        for (const a of assets) {
          map[a.id] = a
        }
        setMeta(map)
      })
      .catch(() => {
        if (!cancelled) setMeta({})
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [assetIds.join(",")])

  return { meta, loading }
}
