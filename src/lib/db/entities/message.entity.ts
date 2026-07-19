import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm"

export type MessageStatus = "processing" | "complete" | "stopped"
export type Role = "user" | "assistant" | "system"

@Entity()
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  conversationId!: string

  @Column()
  userId!: string

  @Column({ nullable: true })
  parentId?: string

  @ManyToOne("Message", { nullable: true })
  @JoinColumn({ name: "parentId" })
  parent?: Message

  @Column({ type: "varchar" })
  role!: Role

  @Column("text")
  content!: string

  @Column({ nullable: true })
  model?: string

  @Column({ type: "varchar", default: "processing" })
  status!: MessageStatus

  @CreateDateColumn()
  createdAt!: Date

  @ManyToOne("Conversation", "messages")
  @JoinColumn({ name: "conversationId" })
  conversation!: unknown
}
