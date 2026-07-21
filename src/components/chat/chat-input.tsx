"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2, Paperclip, FileText } from "lucide-react"
import { toast } from "sonner"

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  conversationId?: string
  onAssetUploaded?: () => void
}

const LONG_PASTE_THRESHOLD = 200
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export function ChatInput({ onSend, disabled, conversationId, onAssetUploaded }: ChatInputProps) {
  const [value, setValue] = useState("")
  const [isLongPaste, setIsLongPaste] = useState(false)
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`
    }
  }, [value])

  const evaluatePasteLength = (text: string) => {
    setIsLongPaste(text.length > LONG_PASTE_THRESHOLD)
  }

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue("")
    setIsLongPaste(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text/plain")
    evaluatePasteLength(pasted)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    if (newValue.length <= LONG_PASTE_THRESHOLD) {
      setIsLongPaste(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("File too large (max 10 MB)")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setUploading(true)

    try {
      let convId = conversationId
      if (!convId) {
        const convRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Chat" }),
        })
        if (!convRes.ok) throw new Error("Failed to create conversation")
        const conv = await convRes.json() as { id: string }
        convId = conv.id
      }

      const formData = new FormData()
      formData.append("file", file)
      formData.append("conversationId", convId)

      const res = await fetch("/api/assets", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Upload failed" })) as { error?: string }
        throw new Error(errBody.error || "Upload failed")
      }

      toast.success("File uploaded")
      onAssetUploaded?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload file")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const uploadDisabled = disabled || uploading

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="max-w-3xl mx-auto">
        {isLongPaste && (
          <div
            className="flex items-center gap-1 mb-2 text-xs text-muted-foreground"
            aria-live="polite"
          >
            <FileText className="h-3 w-3" />
            <span>Long paste will be converted to a .txt asset</span>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Send a message..."
            disabled={disabled}
            className="min-h-[44px] max-h-[200px] resize-none py-3"
            rows={1}
          />
          <Button
            onClick={handleUploadClick}
            disabled={uploadDisabled}
            size="icon"
            variant="secondary"
            className="h-9 w-9 shrink-0"
            aria-label="Upload file"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            size="icon"
            className="h-11 w-11 shrink-0"
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {uploading && (
          <p className="text-xs text-muted-foreground mt-1">Uploading...</p>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        onChange={handleFileChange}
      />
    </div>
  )
}
