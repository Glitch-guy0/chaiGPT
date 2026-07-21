import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { AssetRepositoryImpl } from "@/lib/db/repositories/asset.repository";
import { AssetServiceImpl } from "@/services/asset.service.impl";
import { NotFoundError } from "@/lib/errors";
import { getQdrantStore } from "@/lib/vector/qdrant";
import { invalidateRagCache } from "@/lib/cache/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const ds = await getDatabase();
    const assetRepo = new AssetRepositoryImpl(ds);
    const assetService = new AssetServiceImpl(assetRepo, getQdrantStore());

    const asset = await assetRepo.findById(id, userId);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    await assetService.remove(id, userId);

    invalidateRagCache(asset.conversationId).catch(() => {});

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Assets DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
