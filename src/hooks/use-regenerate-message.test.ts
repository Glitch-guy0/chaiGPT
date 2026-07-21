// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useRegenerateMessage } from "./use-regenerate-message"

function createMockSSEStream(chunks: string[]): ReadableStream {
  const encoder = new TextEncoder()
  let idx = 0
  return new ReadableStream({
    pull(controller) {
      if (idx < chunks.length) {
        controller.enqueue(encoder.encode(chunks[idx]))
        idx++
      } else {
        controller.close()
      }
    },
  })
}

describe("useRegenerateMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("calls POST /api/chat/regenerate/[messageId]", async () => {
    const stream = createMockSSEStream([
      'data: {"content":"Hello"}\n\n',
      'event: done\ndata: {"id":"msg-1","status":"complete"}\n\n',
    ])
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      }),
    )

    const { result } = renderHook(() => useRegenerateMessage())

    result.current.regenerate("msg-1")

    await waitFor(() => expect(result.current.state.isStreaming).toBe(false))

    expect(fetch).toHaveBeenCalledWith("/api/chat/regenerate/msg-1", {
      method: "POST",
      signal: expect.any(AbortSignal),
    })
  })

  it("updates content as tokens arrive", async () => {
    const stream = createMockSSEStream([
      'data: {"content":"Hello"}\n\n',
      'data: {"content":" world"}\n\n',
      'event: done\ndata: {"id":"msg-1","status":"complete"}\n\n',
    ])
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      }),
    )

    const { result } = renderHook(() => useRegenerateMessage())

    result.current.regenerate("msg-1")

    await waitFor(() => expect(result.current.state.content).toBe("Hello world"))
    await waitFor(() => expect(result.current.state.status).toBe("complete"))
  })

  it("sets status to stopped on stream with stopped event", async () => {
    const stream = createMockSSEStream([
      'data: {"content":"Partial"}\n\n',
      'event: stopped\ndata: {"id":"msg-1","status":"stopped"}\n\n',
    ])
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      }),
    )

    const { result } = renderHook(() => useRegenerateMessage())

    result.current.regenerate("msg-1")

    await waitFor(() => {
      expect(result.current.state.isStreaming).toBe(false)
      expect(result.current.state.status).toBe("stopped")
    })
    expect(result.current.state.content).toBe("Partial")
  })

  it("handles fetch error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Can only regenerate stopped assistant messages" }),
      }),
    )

    const { result } = renderHook(() => useRegenerateMessage())

    result.current.regenerate("msg-1")

    await waitFor(() => {
      expect(result.current.state.isStreaming).toBe(false)
      expect(result.current.state.status).toBe("stopped")
    })
    expect(result.current.state.error).toBeDefined()
  })

  it("accepts onUpdate callback with incremental content", async () => {
    const stream = createMockSSEStream([
      'data: {"content":"Hello"}\n\n',
      'event: done\ndata: {"id":"msg-1","status":"complete"}\n\n',
    ])
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      }),
    )

    const onUpdate = vi.fn()
    const { result } = renderHook(() => useRegenerateMessage())

    result.current.regenerate("msg-1", onUpdate)

    await waitFor(() => expect(result.current.state.isStreaming).toBe(false))
    expect(onUpdate).toHaveBeenCalledWith("Hello")
  })
})
