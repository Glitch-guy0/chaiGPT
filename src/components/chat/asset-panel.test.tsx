// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AssetPanel } from "./asset-panel"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const mockAssets = [
  { id: "asset-1", filename: "report.pdf", mime: "application/pdf", createdAt: new Date().toISOString() },
  { id: "asset-2", filename: "notes.txt", mime: "text/plain", createdAt: new Date().toISOString() },
]

afterEach(() => {
  vi.restoreAllMocks()
})

function expandPanel() {
  const toggle = screen.getByRole("button", { name: /assets/i })
  fireEvent.click(toggle)
}

describe("AssetPanel", () => {
  beforeEach(() => {
    vi.spyOn(window, "fetch").mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("/api/assets") && urlStr.includes("conversationId")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockAssets), { status: 200, headers: { "Content-Type": "application/json" } }),
        )
      }
      return Promise.resolve(new Response(null, { status: 404 }))
    })
  })

  it("shows loading skeletons initially", async () => {
    vi.restoreAllMocks()
    vi.spyOn(window, "fetch").mockImplementation(() => new Promise(() => {}))

    render(
      <Wrapper>
        <AssetPanel conversationId="conv-1" />
      </Wrapper>,
    )

    expandPanel()

    await waitFor(() => {
      const skeletons = document.querySelectorAll(".animate-pulse")
      expect(skeletons.length).toBeGreaterThanOrEqual(3)
    })
  })

  it("shows empty state when no assets", async () => {
    vi.restoreAllMocks()
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
    )

    render(
      <Wrapper>
        <AssetPanel conversationId="conv-1" />
      </Wrapper>,
    )

    expandPanel()

    await waitFor(() => {
      expect(screen.getByText("No assets yet")).toBeTruthy()
    })
  })

  it("renders asset list with filenames", async () => {
    render(
      <Wrapper>
        <AssetPanel conversationId="conv-1" />
      </Wrapper>,
    )

    expandPanel()

    await waitFor(() => {
      expect(screen.getByText("report.pdf")).toBeTruthy()
      expect(screen.getByText("notes.txt")).toBeTruthy()
    })
  })

  it("renders delete button for each asset", async () => {
    render(
      <Wrapper>
        <AssetPanel conversationId="conv-1" />
      </Wrapper>,
    )

    expandPanel()

    await waitFor(() => {
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i })
      expect(deleteButtons.length).toBe(2)
    })
  })

  it("shows confirmation dialog on delete click", async () => {
    render(
      <Wrapper>
        <AssetPanel conversationId="conv-1" />
      </Wrapper>,
    )

    expandPanel()

    await waitFor(() => {
      expect(screen.getByText("report.pdf")).toBeTruthy()
    })

    const deleteBtn = screen.getAllByRole("button", { name: /delete report/i })[0]
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText(/Are you sure/i)).toBeTruthy()
    })
  })

  it("calls DELETE and removes asset on confirm", async () => {
    const deleteSpy = vi.spyOn(window, "fetch").mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("/api/assets") && urlStr.includes("conversationId")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockAssets), { status: 200, headers: { "Content-Type": "application/json" } }),
        )
      }
      if (urlStr.includes("/api/assets/") && !urlStr.includes("?")) {
        return Promise.resolve(new Response(null, { status: 200 }))
      }
      return Promise.resolve(new Response(null, { status: 404 }))
    })

    render(
      <Wrapper>
        <AssetPanel conversationId="conv-1" />
      </Wrapper>,
    )

    expandPanel()

    await waitFor(() => {
      expect(screen.getByText("report.pdf")).toBeTruthy()
    })

    const deleteBtn = screen.getAllByRole("button", { name: /delete report/i })[0]
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText(/Are you sure/i)).toBeTruthy()
    })

    const confirmBtn = screen.getByText("Delete")
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      const deleteCalls = deleteSpy.mock.calls.filter(
        ([url]) => typeof url === "string" && url.includes("/api/assets/") && !url.includes("conversationId"),
      )
      expect(deleteCalls.length).toBeGreaterThanOrEqual(1)
    })

    deleteSpy.mockRestore()
  })

  it("cancels delete when cancel is clicked", async () => {
    const deleteSpy = vi.spyOn(window, "fetch")

    render(
      <Wrapper>
        <AssetPanel conversationId="conv-1" />
      </Wrapper>,
    )

    expandPanel()

    await waitFor(() => {
      expect(screen.getByText("report.pdf")).toBeTruthy()
    })

    const deleteBtn = screen.getAllByRole("button", { name: /delete report/i })[0]
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText(/Are you sure/i)).toBeTruthy()
    })

    const cancelBtn = screen.getByText("Cancel")
    fireEvent.click(cancelBtn)

    expect(screen.queryByText(/Are you sure/i)).toBeNull()

    const deleteCalls = deleteSpy.mock.calls.filter(
      ([url]) => typeof url === "string" && url.includes("/api/assets/") && !url.includes("conversationId"),
    )
    expect(deleteCalls.length).toBe(0)

    deleteSpy.mockRestore()
  })

  it("shows error state when fetch fails", async () => {
    vi.restoreAllMocks()
    vi.spyOn(window, "fetch").mockRejectedValue(new Error("Network error"))

    render(
      <Wrapper>
        <AssetPanel conversationId="conv-1" />
      </Wrapper>,
    )

    expandPanel()

    await waitFor(() => {
      expect(screen.getByText(/Failed to load assets/i)).toBeTruthy()
    })
  })

  it("shows empty state when conversationId is undefined", () => {
    render(
      <Wrapper>
        <AssetPanel conversationId={undefined} />
      </Wrapper>,
    )

    expect(screen.getByText(/Send a message to start/i)).toBeTruthy()
  })

  it("shows toggle with asset count after load", async () => {
    render(
      <Wrapper>
        <AssetPanel conversationId="conv-1" />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Assets \(2\)/i)).toBeTruthy()
    })
  })

  it("hides asset list when collapsed", async () => {
    render(
      <Wrapper>
        <AssetPanel conversationId="conv-1" />
      </Wrapper>,
    )

    expandPanel()

    await waitFor(() => {
      expect(screen.getByText("report.pdf")).toBeTruthy()
    })

    const toggle = screen.getByRole("button", { name: /collapse/i })
    fireEvent.click(toggle)

    expect(screen.queryByText("report.pdf")).toBeNull()
  })
})
