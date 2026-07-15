import "reflect-metadata"
import { DataSource } from "typeorm"
import { Conversation } from "./entities/conversation.entity"
import { Message } from "./entities/message.entity"

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: "./chaiGPT.db",
  synchronize: true,
  logging: false,
  entities: [Conversation, Message],
  migrations: [],
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
