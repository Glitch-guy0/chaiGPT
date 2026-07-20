import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1784523236311 implements MigrationInterface {
    name = 'Init1784523236311'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "conversation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "rootConversationId" uuid, "lastMessageId" uuid, "title" character varying NOT NULL, "model" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_864528cb427ce75a89df8996b79" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "message" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "userId" character varying NOT NULL, "parentId" uuid, "role" character varying NOT NULL, "content" text NOT NULL, "model" character varying, "status" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ba01f0a3e0123651915008bc578" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "asset" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "conversationId" uuid NOT NULL, "filename" character varying NOT NULL, "mime" character varying NOT NULL, "path" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1209d107fe21482beaea51b745e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD CONSTRAINT "FK_292a4073fb8c8bcf44eb4fc90f5" FOREIGN KEY ("rootConversationId") REFERENCES "conversation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD CONSTRAINT "FK_bdfdc3d7e59cce3ef56e6d5e181" FOREIGN KEY ("lastMessageId") REFERENCES "message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_66d62a9dc9e658a5c378e906c52" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_a90098f480daebbb1b1c60f27dd" FOREIGN KEY ("parentId") REFERENCES "message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset" ADD CONSTRAINT "FK_ab7a8f94d3ce4dd14457ebefb3b" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "asset" DROP CONSTRAINT "FK_ab7a8f94d3ce4dd14457ebefb3b"`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_a90098f480daebbb1b1c60f27dd"`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_66d62a9dc9e658a5c378e906c52"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP CONSTRAINT "FK_bdfdc3d7e59cce3ef56e6d5e181"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP CONSTRAINT "FK_292a4073fb8c8bcf44eb4fc90f5"`);
        await queryRunner.query(`DROP TABLE "asset"`);
        await queryRunner.query(`DROP TABLE "message"`);
        await queryRunner.query(`DROP TABLE "conversation"`);
    }
}
