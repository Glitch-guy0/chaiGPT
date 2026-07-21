export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export async function extractText(file: File): Promise<string> {
  const mime = file.type;

  if (mime === "text/plain" || mime === "text/markdown") {
    return file.text();
  }

  if (mime === "application/pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    return result.text;
  }

  throw new Error(
    `Unsupported MIME type: ${mime}. Supported types: ${SUPPORTED_MIME_TYPES.join(", ")}`,
  );
}
