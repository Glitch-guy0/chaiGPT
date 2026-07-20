import "reflect-metadata";
import { DataSource } from "typeorm";
import { Conversation } from "./entities/conversation.entity";
import { Message } from "./entities/message.entity";
import { Asset } from "./entities/asset.entity";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/chaigpt",
  synchronize: false,
  logging: false,
  entities: [Conversation, Message, Asset],
  migrations: ["src/schema/migrations/*.ts"],
});
