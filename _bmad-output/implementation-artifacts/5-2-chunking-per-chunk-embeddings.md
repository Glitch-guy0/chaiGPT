# Story 5.2: Chunking & Per-Chunk Embeddings

Status: ready-for-dev

## Story

As a Maintainer,
I want deterministic chunking and one embedding per chunk,
so that retrieval is accurate and citable.

## Acceptance Criteria

1. Given an uploaded PDF or TXT/MD
   When chunking runs
   Then PDFs are split page-by-page and TXT/MD at 2000 characters via LangChain splitters (FR-13)

2. And Qdrant stores exactly one embedding per chunk (FR-14)

3. And each vector record references its parent chunk index + asset id for citation (FR-14)

## Tasks / Subtasks

- [ ] **T1: Implement chunking utility** (AC: 1)
  - [ ] T1.1: Create `src/lib/chunking/chunker.ts` with a `chunkDocument(text: string, mimeType: string): Chunk[]` function
  - [ ] T1.2: For `application/pdf`, use LangChain `PDFPageTextSplitter` (or equivalent) to split page-by-page; each page becomes one chunk
  - [ ] T1.3: For `text/plain` and `text/markdown`, use `CharacterTextSplitter` with `chunkSize: 2000`, `chunkOverlap: 0`
  - [ ] T1.4: Each returned `Chunk` carries `index` (0-based position in document) and `text`
  - [ ] T1.5: Handle empty/zero-length input — return empty array, no embedding call

- [ ] **T2: Wire chunking into QdrantStore.upsertChunks** (AC: 2, 3)
  - [ ] T2.1: Implement `upsertChunks` in `src/lib/vector/qdrant.ts` to iterate over `Chunk[]`, call `embed()` per chunk, and upsert each vector into Qdrant
  - [ ] T2.2: Generate deterministic `chunkId` as `crypto.randomUUID()` per chunk (or deterministic hash of `assetId + index`)
  - [ ] T2.3: Store payload fields: `chunkId`, `assetId`, `index`, `text` alongside the vector
  - [ ] T2.4: Use Qdrant point batching (batch size 64–128) to avoid per-point API calls
  - [ ] T2.5: Collection name derived from `convId` (e.g., `conv_{convId}`) for conversation-scoped isolation

- [ ] **T3: Implement embed() — single-text embedding** (AC: 2)
  - [ ] T3.1: Implement `embed(text: string): Promise<number[]>` using OpenAI `text-embedding-3-small` via `@langchain/openai` or direct OpenAI SDK
  - [ ] T3.2: Return the embedding vector as `number[]`; throw on API failure (no silent fallback)
  - [ ] T3.3: Handle empty/whitespace-only text — return empty array or throw explicit error

- [ ] **T4: Update AssetService.ingest to call chunking + upsert** (AC: 1, 2, 3)
  - [ ] T4.1: After text extraction (Story 5.1), call `chunkDocument(extractedText, asset.mime)` to produce `Chunk[]`
  - [ ] T4.2: Call `qdrantStore.upsertChunks(asset.id, chunks)` to persist vectors
  - [ ] T4.3: Ensure chunking + upsert completes before `AssetRepository.save()` — chain in sequence diagram order
  - [ ] T4.4: On chunking/upsert failure, propagate error and do not save asset record

- [ ] **T5: Unit tests** (Vitest, ≥80% coverage)
  - [ ] T5.1: `__tests__/chunker.test.ts` — test page-by-page PDF splitting (mock LangChain splitter), test 2000-char TXT/MD splitting, test empty input returns `[]`
  - [ ] T5.2: `__tests__/qdrant.test.ts` — mock Qdrant client, verify `upsertChunks` calls `embed` per chunk and upserts correct payload shape
  - [ ] T5.3: `__tests__/asset.service.test.ts` — integration test that `ingest` calls chunker → upsertChunks → save in order
  - [ ] T5.4: Edge cases: file with single page/chunk, file exceeding 2000 chars splits correctly, binary PDF without extractable text

- [ ] **T6: Schema / config** (if needed)
  - [ ] T6.1: Document Qdrant collection config in `schema/vector/` (vector dimensions, distance metric, payload indexes on `assetId`, `chunkId`)
  - [ ] T6.2: Ensure collection is created lazily on first `upsertChunks` call if not exists

## Dev Notes

### LangChain Splitter Configuration

```ts
// TXT / MD — CharacterTextSplitter
import { CharacterTextSplitter } from '@langchain/textsplitters';

const textSplitter = new CharacterTextSplitter({
  chunkSize: 2000,
  chunkOverlap: 0,
  separator: '\n',       // split on newlines when possible
});

// PDF — PDFPageTextSplitter (one chunk per page)
import { PDFPageTextSplitter } from '@langchain/community/document_loaders/fs/pdf';

const pdfSplitter = new PDFPageTextSplitter();
// Each page → one Chunk with index = page number (0-based)
```

**Important:** LangChain splitters return `Document` objects. Map each to the internal `Chunk` type:
```ts
const chunks: Chunk[] = docs.map((doc, i) => ({
  index: i,
  text: doc.pageContent,
}));
```

### Qdrant Collection Schema

Each vector record (point) in Qdrant:

| Field      | Type     | Description                                  |
|------------|----------|----------------------------------------------|
| `id`       | UUID     | Deterministic: UUID v5 of `assetId + index`  |
| `vector`   | float[]  | Embedding from `embed()` (1536 for small-3)  |
| `payload`  | object   | `{ chunkId, assetId, index, text }`          |

**Collection config:**
```ts
{
  vectors: {
    size: 1536,               // text-embedding-3-small dimension
    distance: "Cosine",
  },
  payload_schema: {
    assetId: "keyword",
    chunkId: "keyword",
    index: "integer",
  }
}
```

Collection name convention: `conv_{convId}` — scoped per conversation. Created lazily.

### Chunking Strategy Details

- **PDF:** Page-by-page. Each page = 1 chunk. If a page is empty (blank page), skip it (do not create a zero-content chunk).
- **TXT/MD:** CharacterTextSplitter with 2000-char limit. No overlap (overlap=0). Splits on `\n` boundary when possible; falls back to mid-word split only if a single line exceeds 2000 chars.
- **Binary PDFs without extractable text:** After text extraction (Story 5.1), if `text` is null/empty, chunking returns `[]`, no embeddings are created. Asset record is saved with `text: null` to indicate non-indexable content. This is a valid state — not an error.

### Deterministic chunkId Generation

```ts
import { v5 as uuidv5 } from 'uuid';

function chunkId(assetId: string, index: number): string {
  return uuidv5(`${assetId}::${index}`, UUID_NAMESPACE);
}
```

This ensures the same chunk is always identified the same way, enabling idempotent upserts.

### Upsert Batching

```ts
// Qdrant point batching
const BATCH_SIZE = 128;

for (let i = 0; i < points.length; i += BATCH_SIZE) {
  const batch = points.slice(i, i + BATCH_SIZE);
  await qdrant.upsert(collectionName, { points: batch });
}
```

### Error Handling

- **Embedding API failure:** Throw immediately. Do not partially upsert. Asset ingestion fails cleanly.
- **Qdrant connection failure:** Throw. Asset record not saved. User sees error.
- **Empty document (no extractable text):** Return empty chunks array. Save asset with `text: null`. No vectors created. This is expected behavior, not an error.

### File Paths to Create / Modify

| Action   | File Path                                    | Description                          |
|----------|----------------------------------------------|--------------------------------------|
| CREATE   | `src/lib/chunking/chunker.ts`                | Chunking utility                     |
| CREATE   | `src/lib/chunking/__tests__/chunker.test.ts` | Chunking unit tests                  |
| MODIFY   | `src/lib/vector/qdrant.ts`                   | Implement `upsertChunks`, `embed`    |
| CREATE   | `src/lib/vector/__tests__/qdrant.test.ts`    | Qdrant store unit tests              |
| MODIFY   | `src/services/asset.service.ts`              | Wire chunking into `ingest` flow     |
| CREATE   | `schema/vector/collections.ts`               | Qdrant collection config (optional)  |

### Dependencies

- `@langchain/textsplitters` — install if not present (check `package.json`)
- `@langchain/community` — for `PDFPageTextSplitter` (check availability)
- `@qdrant/js-client-rest` — Qdrant client (check `package.json`)
- `uuid` — for deterministic chunk IDs (check `package.json`)

### Testing Approach

- **Framework:** Vitest (project standard)
- **Mocking strategy:** Mock Qdrant client methods (`upsert`, `createCollection`); mock LangChain splitters for chunking tests; mock OpenAI embedding API for embed tests
- **Coverage target:** ≥80% (project standard)
- **Test isolation:** Each test file creates/tears down its own test data; no shared mutable state between tests

### Edge Cases

| Scenario                         | Expected Behavior                                        |
|----------------------------------|----------------------------------------------------------|
| Empty file (0 bytes)             | `chunkDocument` returns `[]`. No vectors. Asset saved.   |
| PDF with blank pages             | Blank pages skipped. Non-empty pages become chunks.      |
| TXT exactly 2000 chars           | Single chunk. No split.                                  |
| TXT 2001 chars                   | Two chunks. Split at newline boundary or char 2000.      |
| Binary PDF without text          | `text: null` after extraction. `chunkDocument` → `[]`.   |
| Very large file (>100k chars)    | Many chunks. Batching handles Qdrant upsert correctly.   |
| Non-UTF-8 encoding (Latin-1)    | Normalize to UTF-8 before chunking.                      |
| Concurrent uploads same conv     | Qdrant upsert is idempotent by point ID. Safe.           |
