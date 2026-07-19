import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { AssetServiceImpl } from "@/services/asset.service"
import { TypeORMAssetRepository } from "@/lib/db/repositories/asset.repository"
import { LangChainQdrantStore } from "@/lib/vector/qdrant"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function getService() {
  const repo = await TypeORMAssetRepository.create()
  const qdrant = new LangChainQdrantStore()
  return new AssetServiceImpl(repo, qdrant)
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const conversationId = formData.get("conversationId") as string | null

    if (!file || !conversationId) {
      return NextResponse.json(
        { error: "Missing required fields: file, conversationId" },
        { status: 400 }
      )
    }

    const service = await getService()
    const asset = await service.ingest(userId, conversationId, file)

    return NextResponse.json(
      { id: asset.id, filename: asset.filename, mime: asset.mime },
      { status: 201 }
    )
  } catch (error) {
    console.error("Asset upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Missing required query param: id" },
        { status: 400 }
      )
    }

    const service = await getService()
    await service.remove(id, userId)

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Asset delete error:", error)
    const status = error instanceof Error && error.message === "Asset not found" ? 404 : 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status }
    )
  }
}
