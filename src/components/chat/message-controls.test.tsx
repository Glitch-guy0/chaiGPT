// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MessageControls } from "./message-controls"

describe("MessageControls", () => {
  it("renders edit button on user messages", () => {
    render(
      <MessageControls
        messageId="msg-1"
        role="user"
        status="complete"
        isLatestUser={true}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    )
    expect(screen.getByLabelText("Edit message")).toBeTruthy()
  })

  it("does not render edit button on assistant messages", () => {
    render(
      <MessageControls
        messageId="msg-1"
        role="assistant"
        status="complete"
        isLatestUser={false}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText("Edit message")).toBeNull()
  })

  it("disables edit button when isLatestUser is false", () => {
    render(
      <MessageControls
        messageId="msg-1"
        role="user"
        status="complete"
        isLatestUser={false}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    )
    const btn = screen.getByLabelText("Edit message")
    expect(btn.hasAttribute("disabled")).toBe(true)
  })

  it("renders regenerate button on stopped assistant messages", () => {
    render(
      <MessageControls
        messageId="msg-1"
        role="assistant"
        status="stopped"
        isLatestUser={false}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    )
    expect(screen.getByLabelText("Regenerate response")).toBeTruthy()
  })

  it("does not render regenerate button on complete assistant messages", () => {
    render(
      <MessageControls
        messageId="msg-1"
        role="assistant"
        status="complete"
        isLatestUser={false}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText("Regenerate response")).toBeNull()
  })

  it("does not render regenerate button on user messages (even if stopped)", () => {
    render(
      <MessageControls
        messageId="msg-1"
        role="user"
        status="stopped"
        isLatestUser={false}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText("Regenerate response")).toBeNull()
  })

  it("shows spinner instead of buttons when isLoading is true", () => {
    render(
      <MessageControls
        messageId="msg-1"
        role="user"
        status="stopped"
        isLatestUser={true}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
        isLoading={true}
      />,
    )
    expect(screen.getByLabelText("Loading")).toBeTruthy()
    expect(screen.queryByLabelText("Edit message")).toBeNull()
    expect(screen.queryByLabelText("Regenerate response")).toBeNull()
  })

  it("calls onEdit when edit button clicked", () => {
    const onEdit = vi.fn()
    render(
      <MessageControls
        messageId="msg-1"
        role="user"
        status="complete"
        isLatestUser={true}
        onEdit={onEdit}
        onRegenerate={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText("Edit message"))
    expect(onEdit).toHaveBeenCalledWith("msg-1")
  })

  it("calls onRegenerate when regenerate button clicked", () => {
    const onRegenerate = vi.fn()
    render(
      <MessageControls
        messageId="msg-1"
        role="assistant"
        status="stopped"
        isLatestUser={false}
        onEdit={vi.fn()}
        onRegenerate={onRegenerate}
      />,
    )
    fireEvent.click(screen.getByLabelText("Regenerate response"))
    expect(onRegenerate).toHaveBeenCalledWith("msg-1")
  })
})
