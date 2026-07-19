import "reflect-metadata"
import { DataSource } from "typeorm"
import { Conversation } from "./lib/db/entities/conversation.entity"
import { Message } from "./lib/db/entities/message.entity"
import { Asset } from "./lib/db/entities/asset.entity"

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  entities: [Conversation, Message, Asset],
  migrations: ["src/migrations/*.ts"],
})
