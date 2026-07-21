// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { StreamingMessage } from "./streaming-message"

describe("StreamingMessage", () => {
  it("renders plain text as inline content", () => {
    render(<StreamingMessage content="Hello world" />)
    expect(screen.getByText("Hello world")).toBeTruthy()
  })

  it("renders bold markdown as strong element", () => {
    render(<StreamingMessage content="This is **bold** text" />)
    const strong = document.querySelector("strong")
    expect(strong).toBeTruthy()
    expect(strong!.textContent).toBe("bold")
  })

  it("renders code blocks with pre/code elements", () => {
    render(<StreamingMessage content={"```\nconst x = 1\n```"} />)
    const pre = document.querySelector("pre")
    expect(pre).toBeTruthy()
    const code = document.querySelector("code")
    expect(code).toBeTruthy()
  })

  it("renders list items as ul/li", () => {
    render(<StreamingMessage content={"- item 1\n- item 2"} />)
    const list = document.querySelector("ul")
    expect(list).toBeTruthy()
    const items = document.querySelectorAll("li")
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it("shows streaming indicator when isStreaming and content is empty", () => {
    render(<StreamingMessage content="" isStreaming={true} />)
    const indicator = screen.getByLabelText("Generating response")
    expect(indicator).toBeTruthy()
    const container = screen.getByRole("status")
    expect(container).toBeTruthy()
  })

  it("does not show streaming indicator when content is non-empty", () => {
    render(<StreamingMessage content="Hello" isStreaming={true} />)
    expect(screen.queryByLabelText("Generating response")).toBeNull()
    expect(screen.getByText("Hello")).toBeTruthy()
  })

  it("shows complete badge when status is complete", () => {
    render(<StreamingMessage content="Done" status="complete" />)
    expect(screen.getByText("Complete")).toBeTruthy()
  })

  it("shows stopped badge when status is stopped", () => {
    render(<StreamingMessage content="Partial" status="stopped" />)
    expect(screen.getByText("Stopped")).toBeTruthy()
  })

  it("shows terminated fallback when stopped with empty content", () => {
    render(<StreamingMessage content="" status="stopped" />)
    expect(screen.getByText("User terminated the response")).toBeTruthy()
  })

  it("shows empty response text when complete with empty content", () => {
    render(<StreamingMessage content="" status="complete" />)
    expect(screen.getByText("[Empty response]")).toBeTruthy()
  })

  it("renders citations section when citations array provided", () => {
    const citations = [
      { chunkId: "chunk-1", assetId: "asset-1", score: 0.95, snippet: "Relevant info", title: "Doc 1", url: "https://example.com/doc1" },
      { chunkId: "chunk-2", assetId: "asset-2", score: 0.85, snippet: "More info" },
    ]
    render(<StreamingMessage content="Response" status="complete" citations={citations} />)
    expect(screen.getByText("Sources")).toBeTruthy()
    expect(screen.getByText("Doc 1")).toBeTruthy()
    expect(screen.getByText("Source 2")).toBeTruthy()
    const link = document.querySelector("a")
    expect(link).toBeTruthy()
    expect(link!.getAttribute("href")).toBe("https://example.com/doc1")
    expect(link!.getAttribute("target")).toBe("_blank")
  })

  it("sets aria-live polite when streaming", () => {
    render(<StreamingMessage content="Hello" isStreaming={true} />)
    const container = screen.getByRole("status")
    expect(container.getAttribute("aria-live")).toBe("polite")
  })

  it("sets aria-live off when not streaming", () => {
    render(<StreamingMessage content="Hello" />)
    const container = screen.getByRole("status")
    expect(container.getAttribute("aria-live")).toBe("off")
  })
})
