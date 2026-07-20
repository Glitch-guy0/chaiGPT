import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1721480400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id"                uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId"            character varying NOT NULL,
        "rootConversationId" character varying,
        "lastMessageId"     character varying,
        "title"             character varying NOT NULL,
        "model"             character varying,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
        "conversationId" uuid NOT NULL,
        "userId"         character varying NOT NULL,
        "parentId"       uuid,
        "role"           character varying NOT NULL,
        "content"        text NOT NULL,
        "model"          character varying,
        "status"         character varying NOT NULL,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "assets" (
        "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId"         character varying NOT NULL,
        "conversationId" uuid NOT NULL,
        "filename"       character varying NOT NULL,
        "mime"           character varying NOT NULL,
        "path"           character varying NOT NULL,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assets" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "assets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversations"`);
  }
}
