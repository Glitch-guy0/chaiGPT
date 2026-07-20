import { DataSource } from "typeorm";
import { Conversation } from "@/lib/db/entities/conversation.entity";
import { Message } from "@/lib/db/entities/message.entity";
import { Asset } from "@/lib/db/entities/asset.entity";

export async function createTestDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type: "sqlite",
    database: ":memory:",
    entities: [Conversation, Message, Asset],
    synchronize: true,
  });
  await ds.initialize();
  return ds;
}

export async function seedTestData(ds: DataSource) {
  const convRepo = ds.getRepository(Conversation);
  const msgRepo = ds.getRepository(Message);
  const assetRepo = ds.getRepository(Asset);

  const conv1 = await convRepo.save({
    userId: "user-1",
    title: "Test Conversation 1",
    model: "gpt-4o-mini",
  });
  const conv2 = await convRepo.save({
    userId: "user-1",
    title: "Test Conversation 2",
  });

  await msgRepo.save({
    conversationId: conv1.id,
    userId: "user-1",
    role: "user",
    content: "Hello",
    status: "complete",
  });
  await msgRepo.save({
    conversationId: conv1.id,
    userId: "user-1",
    role: "assistant",
    content: "Hi there",
    status: "complete",
  });

  await assetRepo.save({
    userId: "user-1",
    conversationId: conv1.id,
    filename: "test.txt",
    mime: "text/plain",
    path: "/tmp/test.txt",
  });

  return { conv1, conv2 };
}
