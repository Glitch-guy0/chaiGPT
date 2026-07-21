// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useEditMessage } from "./use-edit-message"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("useEditMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("calls PATCH /api/conversations/[id]/edit with correct body", async () => {
    const mockResult = {
      userMessage: { id: "msg-1", content: "edited content" },
      assistantMessage: { id: "msg-2", content: "" },
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    })
    vi.stubGlobal("fetch", fetchMock)

    const { result } = renderHook(() => useEditMessage(), { wrapper: createWrapper() })

    result.current.mutate({ conversationId: "conv-1", content: "edited content" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(fetchMock).toHaveBeenCalledWith("/api/conversations/conv-1/edit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "edited content" }),
    })
  })

  it("returns the edit result on success", async () => {
    const mockResult = {
      userMessage: { id: "msg-1", content: "edited content" },
      assistantMessage: { id: "msg-2", content: "" },
    }
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult),
      }),
    )

    const { result } = renderHook(() => useEditMessage(), { wrapper: createWrapper() })

    result.current.mutate({ conversationId: "conv-1", content: "edited content" })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockResult)
    })
  })

  it("handles error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      }),
    )

    const { result } = renderHook(() => useEditMessage(), { wrapper: createWrapper() })

    result.current.mutate({ conversationId: "conv-1", content: "edited content" })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeDefined()
  })
})
