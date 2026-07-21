"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Check, X, Loader2 } from "lucide-react"

interface EditMessageInputProps {
  initialContent: string
  onSubmit: (content: string) => void
  onCancel: () => void
  isSubmitting?: boolean
}

export function EditMessageInput({
  initialContent,
  onSubmit,
  onCancel,
  isSubmitting,
}: EditMessageInputProps) {
  const [content, setContent] = useState(initialContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cancelRef = useRef(true)

  const isUnchanged = content === initialContent
  const isEmpty = content.trim().length === 0
  const isDisabled = isUnchanged || isEmpty || isSubmitting

  const handleSubmit = useCallback(() => {
    if (isDisabled) return
    cancelRef.current = false
    onSubmit(content)
  }, [content, isDisabled, onSubmit])

  const handleCancel = useCallback(() => {
    cancelRef.current = true
    onCancel()
  }, [onCancel])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        handleCancel()
      }
    },
    [handleSubmit, handleCancel],
  )

  const handleBlur = useCallback(() => {
    if (!cancelRef.current) {
      cancelRef.current = true
      return
    }
    handleCancel()
  }, [handleCancel])

  const handleButtonMouseDown = useCallback(() => {
    cancelRef.current = false
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(content.length, content.length)
    }
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="min-h-[60px] resize-y"
        aria-label="Edit message content"
      />
      <div className="flex gap-1 justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={isDisabled}
          onClick={handleSubmit}
          onMouseDown={handleButtonMouseDown}
          aria-label="Save"
        >
          {isSubmitting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={isSubmitting}
          onClick={handleCancel}
          onMouseDown={handleButtonMouseDown}
          aria-label="Cancel"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
