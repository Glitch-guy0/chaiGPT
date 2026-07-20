import "reflect-metadata"
import { DataSource } from "typeorm"

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "chaigpt",
  username: process.env.DB_USER || "chaigpt",
  password: process.env.DB_PASSWORD || "chaigpt",
  synchronize: false,
  logging: false,
  entities: ["src/lib/db/entities/*.entity.ts"],
  migrations: ["src/lib/db/migrations/*.ts"],
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
