import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { AssetRepositoryImpl } from "@/lib/db/repositories/asset.repository";
import { ConversationRepositoryImpl } from "@/lib/db/repositories/conversation.repository";
import { AssetServiceImpl } from "@/services/asset.service.impl";
import { AssetSchema } from "@/lib/validation/schemas";
import { NotFoundError } from "@/lib/errors";
import { invalidateRagCache } from "@/lib/cache/redis";
import { getQdrantStore } from "@/lib/vector/qdrant";
import { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function sniffMime(buffer: Uint8Array, declaredMime: string): string {
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "application/pdf";
  }
  if (
    buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ||
    buffer[0] === 0xff && buffer[1] === 0xfe ||
    buffer[0] === 0xfe && buffer[1] === 0xff
  ) {
    return declaredMime;
  }
  return declaredMime;
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");
    const idsParam = searchParams.get("ids");

    const ds = await getDatabase();
    const assetRepo = new AssetRepositoryImpl(ds);

    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0 || ids.length > 20) {
        return NextResponse.json(
          { error: "ids must contain 1-20 comma-separated UUIDs" },
          { status: 400 },
        );
      }
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (ids.some((id) => !uuidRe.test(id))) {
        return NextResponse.json(
          { error: "All ids must be valid UUIDs" },
          { status: 400 },
        );
      }
      const assets = await assetRepo.findIds(ids, userId);
      return NextResponse.json(assets);
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: "Missing conversationId query parameter" },
        { status: 400 },
      );
    }

    const parsed = AssetSchema.safeParse({ filename: "x", mime: "x", conversationId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid conversationId", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const assets = await assetRepo.findByConversation(conversationId, userId);

    return NextResponse.json(assets);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Assets GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const conversationId = formData.get("conversationId");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing or invalid file" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid conversationId" },
        { status: 400 },
      );
    }

    const headerBuf = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const sniffedMime = sniffMime(headerBuf, file.type);

    const parsed = AssetSchema.safeParse({
      filename: file.name,
      mime: sniffedMime,
      conversationId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const ds = await getDatabase();
    const conversationRepo = new ConversationRepositoryImpl(ds);
    const conversation = await conversationRepo.findById(conversationId, userId);

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const assetRepo = new AssetRepositoryImpl(ds);
    const assetService = new AssetServiceImpl(assetRepo, getQdrantStore());
    const asset = await assetService.ingest(userId, conversationId, file);

    invalidateRagCache(conversationId).catch((err) => {
      console.warn("[Assets] Cache invalidation failed:", err);
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof Error && (error as Error & { status?: number }).status === 400) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Assets POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
