import { describe, it, expect, vi } from "vitest";

vi.mock("pdf-parse", () => {
  class MockPDFParse {
    getText = vi.fn().mockResolvedValue({ text: "PDF content here" });
    constructor(_opts: unknown) {}
  }
  return { PDFParse: MockPDFParse };
});

const { extractText, SUPPORTED_MIME_TYPES } = await import("./text-extractor");

describe("extractText", () => {
  it("extracts text from plain text file", async () => {
    const file = new File(["hello world"], "note.txt", { type: "text/plain" });
    const result = await extractText(file);
    expect(result).toBe("hello world");
  });

  it("extracts text from markdown file", async () => {
    const file = new File(["# Title"], "readme.md", { type: "text/markdown" });
    const result = await extractText(file);
    expect(result).toBe("# Title");
  });

  it("extracts text from pdf via pdf-parse", async () => {
    const file = new File(["pdf bytes"], "doc.pdf", { type: "application/pdf" });
    const result = await extractText(file);
    expect(result).toBe("PDF content here");
  });

  it("throws for unsupported mime type", async () => {
    const file = new File(["data"], "img.png", { type: "image/png" });
    await expect(extractText(file)).rejects.toThrow("Unsupported MIME type");
  });

  it("SUPPORTED_MIME_TYPES contains expected types", () => {
    expect(SUPPORTED_MIME_TYPES).toContain("application/pdf");
    expect(SUPPORTED_MIME_TYPES).toContain("text/plain");
    expect(SUPPORTED_MIME_TYPES).toContain("text/markdown");
  });
});
