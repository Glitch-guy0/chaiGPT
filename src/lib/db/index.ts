import "reflect-metadata";
import { AppDataSource } from "./data-source";

export async function initializeDatabase() {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }
  await AppDataSource.initialize();
  return AppDataSource;
}

export async function getDatabase() {
  if (!AppDataSource.isInitialized) {
    await initializeDatabase();
  }
  return AppDataSource;
}
