import "reflect-metadata"
import { DataSource } from "typeorm"
import { Conversation } from "./entities/conversation.entity"
import { Message } from "./entities/message.entity"
import { Asset } from "./entities/asset.entity"

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "chaigpt",
  username: process.env.DB_USER || "chaigpt",
  password: process.env.DB_PASSWORD || "chaigpt",
  synchronize: process.env.DB_SYNCHRONIZE === "true" || process.env.NODE_ENV !== "production",
  logging: false,
  entities: [Conversation, Message, Asset],
  migrations: process.env.RUN_MIGRATIONS === "true" ? ["src/lib/db/migrations/*.ts"] : [],
})

export default AppDataSource

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
