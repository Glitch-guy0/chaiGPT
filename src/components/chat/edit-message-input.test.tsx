// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { EditMessageInput } from "./edit-message-input"

describe("EditMessageInput", () => {
  it("renders textarea pre-filled with initialContent", () => {
    render(
      <EditMessageInput
        initialContent="Hello world"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const textarea = screen.getByRole("textbox")
    expect(textarea).toBeTruthy()
    expect((textarea as HTMLTextAreaElement).value).toBe("Hello world")
  })

  it("calls onSubmit with edited content on Enter (without Shift)", () => {
    const onSubmit = vi.fn()
    render(
      <EditMessageInput
        initialContent="Hello"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )
    const textarea = screen.getByRole("textbox")
    fireEvent.change(textarea, { target: { value: "Hello edited" } })
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false })
    expect(onSubmit).toHaveBeenCalledWith("Hello edited")
  })

  it("does not call onSubmit on Shift+Enter", () => {
    const onSubmit = vi.fn()
    render(
      <EditMessageInput
        initialContent="Hello"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )
    const textarea = screen.getByRole("textbox")
    fireEvent.change(textarea, { target: { value: "Hello edited" } })
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("calls onCancel on Escape", () => {
    const onCancel = vi.fn()
    render(
      <EditMessageInput
        initialContent="Hello"
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    )
    const textarea = screen.getByRole("textbox")
    fireEvent.keyDown(textarea, { key: "Escape" })
    expect(onCancel).toHaveBeenCalled()
  })

  it("calls onCancel on blur (outside click)", () => {
    const onCancel = vi.fn()
    render(
      <EditMessageInput
        initialContent="Hello"
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    )
    const textarea = screen.getByRole("textbox")
    fireEvent.blur(textarea)
    expect(onCancel).toHaveBeenCalled()
  })

  it("submit button disabled when content unchanged", () => {
    render(
      <EditMessageInput
        initialContent="Hello"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const submitBtn = screen.getByLabelText("Save")
    expect(submitBtn.hasAttribute("disabled")).toBe(true)
  })

  it("submit button disabled when content empty", () => {
    render(
      <EditMessageInput
        initialContent="Hello"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const textarea = screen.getByRole("textbox")
    fireEvent.change(textarea, { target: { value: "" } })
    const submitBtn = screen.getByLabelText("Save")
    expect(submitBtn.hasAttribute("disabled")).toBe(true)
  })

  it("submit button enabled when content changed and non-empty", () => {
    render(
      <EditMessageInput
        initialContent="Hello"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const textarea = screen.getByRole("textbox")
    fireEvent.change(textarea, { target: { value: "Hello edited" } })
    const submitBtn = screen.getByLabelText("Save")
    expect(submitBtn.hasAttribute("disabled")).toBe(false)
  })

  it("shows spinner on submit button when isSubmitting", () => {
    render(
      <EditMessageInput
        initialContent="Hello"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isSubmitting={true}
      />,
    )
    const textarea = screen.getByRole("textbox")
    fireEvent.change(textarea, { target: { value: "Hello edited" } })
    const submitBtn = screen.getByLabelText("Save")
    const spinner = submitBtn.querySelector(".animate-spin")
    expect(spinner).toBeTruthy()
  })
})
