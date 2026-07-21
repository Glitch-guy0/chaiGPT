// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ChatInput } from "./chat-input"

const LONG_PASTE = "x".repeat(201)
const SHORT_PASTE = "x".repeat(100)

beforeEach(() => {
  vi.spyOn(window, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "conv-1" }), { status: 200, headers: { "Content-Type": "application/json" } }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("ChatInput paste detection", () => {
  it("shows paste indicator badge when pasted text > 200 chars", () => {
    render(<ChatInput onSend={vi.fn()} />)
    const textarea = screen.getByRole("textbox")

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => LONG_PASTE },
    })

    expect(screen.getByText(/Long paste will be converted/i)).toBeTruthy()
  })

  it("does NOT show paste indicator when pasted text ≤ 200 chars", () => {
    render(<ChatInput onSend={vi.fn()} />)
    const textarea = screen.getByRole("textbox")

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => SHORT_PASTE },
    })

    expect(screen.queryByText(/Long paste will be converted/i)).toBeNull()
  })

  it("does NOT show paste indicator for non-paste typed input", () => {
    render(<ChatInput onSend={vi.fn()} />)
    const textarea = screen.getByRole("textbox")

    fireEvent.change(textarea, { target: { value: LONG_PASTE } })

    expect(screen.queryByText(/Long paste will be converted/i)).toBeNull()
  })

  it("hides paste indicator when textarea content falls below 200 chars after paste", () => {
    render(<ChatInput onSend={vi.fn()} />)
    const textarea = screen.getByRole("textbox")

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => LONG_PASTE },
    })

    expect(screen.getByText(/Long paste will be converted/i)).toBeTruthy()

    fireEvent.change(textarea, { target: { value: SHORT_PASTE } })

    expect(screen.queryByText(/Long paste will be converted/i)).toBeNull()
  })

  it("does NOT break existing keyboard input (Enter to submit)", () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)
    const textarea = screen.getByRole("textbox")

    fireEvent.change(textarea, { target: { value: "hello" } })
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false })

    expect(onSend).toHaveBeenCalledWith("hello")
  })

  it("shows FileText icon in paste badge", () => {
    render(<ChatInput onSend={vi.fn()} />)
    const textarea = screen.getByRole("textbox")

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => LONG_PASTE },
    })

    const indicator = screen.getByText(/Long paste will be converted/i).closest("div")
    expect(indicator?.querySelector("svg")).toBeTruthy()
  })

  it("has aria-live polite on paste indicator", () => {
    render(<ChatInput onSend={vi.fn()} />)
    const textarea = screen.getByRole("textbox")

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => LONG_PASTE },
    })

    const badge = screen.getByText(/Long paste will be converted/i).closest("[aria-live]")
    expect(badge?.getAttribute("aria-live")).toBe("polite")
  })
})

describe("ChatInput file upload", () => {
  it("renders upload button with Paperclip icon", () => {
    render(<ChatInput onSend={vi.fn()} />)
    const uploadBtn = screen.getByLabelText("Upload file")
    expect(uploadBtn).toBeTruthy()
    expect(uploadBtn.querySelector("svg")).toBeTruthy()
  })

  it("renders hidden file input", () => {
    render(<ChatInput onSend={vi.fn()} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()
    expect(fileInput.hasAttribute("hidden")).toBe(true)
    expect(fileInput.accept).toContain(".pdf")
    expect(fileInput.accept).toContain(".txt")
    expect(fileInput.accept).toContain(".md")
  })

  it("opens file picker when upload button clicked", () => {
    render(<ChatInput onSend={vi.fn()} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, "click")

    fireEvent.click(screen.getByLabelText("Upload file"))

    expect(clickSpy).toHaveBeenCalled()
  })

  it("shows loading spinner during upload", async () => {
    let resolveUpload!: (value: Response) => void
    const uploadPromise = new Promise<Response>((resolve) => { resolveUpload = resolve })

    vi.spyOn(window, "fetch").mockImplementation(() => uploadPromise)

    render(<ChatInput onSend={vi.fn()} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(["test content"], "test.txt", { type: "text/plain" })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByLabelText("Upload file").querySelector(".animate-spin")).toBeTruthy()
    })

    resolveUpload(new Response(JSON.stringify({ id: "asset-1" }), { status: 200 }))
  })

  it("shows uploading text for accessibility", async () => {
    let resolveUpload!: (value: Response) => void
    const uploadPromise = new Promise<Response>((resolve) => { resolveUpload = resolve })

    vi.spyOn(window, "fetch").mockImplementation(() => uploadPromise)

    render(<ChatInput onSend={vi.fn()} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(["test content"], "test.txt", { type: "text/plain" })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText("Uploading...")).toBeTruthy()
    })

    resolveUpload(new Response(JSON.stringify({ id: "asset-1" }), { status: 200 }))
  })

  it("rejects files larger than 10MB client-side — does not call fetch", async () => {
    const fetchSpy = vi.spyOn(window, "fetch")

    render(<ChatInput onSend={vi.fn()} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    const bigBlob = new Blob(["x".repeat(11 * 1024 * 1024)])
    const bigFile = new File([bigBlob], "large.txt", { type: "text/plain" })
    Object.defineProperty(bigFile, "size", { value: 11 * 1024 * 1024 })

    fireEvent.change(fileInput, { target: { files: [bigFile] } })

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it("clears file input value after upload attempt", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "asset-1" }), { status: 200 }),
    )

    render(<ChatInput onSend={vi.fn()} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, "value", { writable: true, value: "test.txt" })

    const file = new File(["test"], "test.txt", { type: "text/plain" })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(fileInput.value).toBe("")
    })

    fetchSpy.mockRestore()
  })
})
