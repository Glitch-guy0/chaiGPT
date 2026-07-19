import "reflect-metadata"
import { DataSource } from "typeorm"
import { Conversation } from "./entities/conversation.entity"
import { Message } from "./entities/message.entity"
import { Asset } from "./entities/asset.entity"

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  entities: [Conversation, Message, Asset],
  migrations: ["src/migrations/*.ts"],
})

export async function initializeDatabase() {
  if (AppDataSource.isInitialized) {
    return AppDataSource
  }

  await AppDataSource.initialize()
  return AppDataSource
}

export async function getDatabase() {
  if (!AppDataSource.isInitialized) {
    await initializeDatabase()
  }
  return AppDataSource
}

export { Conversation } from "./entities/conversation.entity"
export { Message } from "./entities/message.entity"
export { Asset } from "./entities/asset.entity"

export type { ConversationRepository, ConversationStatus } from "./repositories/conversation.repository"
export type { MessageRepository } from "./repositories/message.repository"
export type { AssetRepository } from "./repositories/asset.repository"
