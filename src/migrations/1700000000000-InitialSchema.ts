import { MigrationInterface, QueryRunner } from "typeorm"

export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

    await queryRunner.query(`
      CREATE TABLE "conversation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "rootConversationId" character varying,
        "lastMessageId" character varying,
        "title" character varying NOT NULL,
        "model" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "message" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" character varying NOT NULL,
        "userId" character varying NOT NULL,
        "parentId" character varying,
        "role" character varying NOT NULL,
        "content" text NOT NULL,
        "model" character varying,
        "status" character varying NOT NULL DEFAULT 'processing',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "asset" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "conversationId" character varying NOT NULL,
        "filename" character varying NOT NULL,
        "mime" character varying NOT NULL,
        "path" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_asset" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_userId" ON "conversation" ("userId")
    `)
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_rootConversationId" ON "conversation" ("rootConversationId")
    `)
    await queryRunner.query(`
      CREATE INDEX "IDX_message_conversationId" ON "message" ("conversationId")
    `)
    await queryRunner.query(`
      CREATE INDEX "IDX_message_userId" ON "message" ("userId")
    `)
    await queryRunner.query(`
      CREATE INDEX "IDX_message_parentId" ON "message" ("parentId")
    `)
    await queryRunner.query(`
      CREATE INDEX "IDX_asset_conversationId" ON "asset" ("conversationId")
    `)
    await queryRunner.query(`
      CREATE INDEX "IDX_asset_userId" ON "asset" ("userId")
    `)

    await queryRunner.query(`
      ALTER TABLE "conversation"
      ADD CONSTRAINT "FK_conversation_rootConversationId"
      FOREIGN KEY ("rootConversationId")
      REFERENCES "conversation"("id")
      ON DELETE SET NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "message"
      ADD CONSTRAINT "FK_message_conversationId"
      FOREIGN KEY ("conversationId")
      REFERENCES "conversation"("id")
      ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "message"
      ADD CONSTRAINT "FK_message_parentId"
      FOREIGN KEY ("parentId")
      REFERENCES "message"("id")
      ON DELETE SET NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "asset"
      ADD CONSTRAINT "FK_asset_conversationId"
      FOREIGN KEY ("conversationId")
      REFERENCES "conversation"("id")
      ON DELETE CASCADE
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "asset" DROP CONSTRAINT "FK_asset_conversationId"`)
    await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_message_parentId"`)
    await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_message_conversationId"`)
    await queryRunner.query(`ALTER TABLE "conversation" DROP CONSTRAINT "FK_conversation_rootConversationId"`)

    await queryRunner.query(`DROP INDEX "IDX_asset_userId"`)
    await queryRunner.query(`DROP INDEX "IDX_asset_conversationId"`)
    await queryRunner.query(`DROP INDEX "IDX_message_parentId"`)
    await queryRunner.query(`DROP INDEX "IDX_message_userId"`)
    await queryRunner.query(`DROP INDEX "IDX_message_conversationId"`)
    await queryRunner.query(`DROP INDEX "IDX_conversation_rootConversationId"`)
    await queryRunner.query(`DROP INDEX "IDX_conversation_userId"`)

    await queryRunner.query(`DROP TABLE "asset"`)
    await queryRunner.query(`DROP TABLE "message"`)
    await queryRunner.query(`DROP TABLE "conversation"`)

    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`)
  }
}
