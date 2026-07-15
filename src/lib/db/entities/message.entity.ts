import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm"

@Entity()
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  conversationId!: string

  @Column({ type: "varchar" })
  role!: "user" | "assistant" | "system"

  @Column("text")
  content!: string

  @Column({ nullable: true })
  model?: string

  @CreateDateColumn()
  createdAt!: Date

  @ManyToOne("Conversation", "messages")
  @JoinColumn({ name: "conversationId" })
  conversation!: unknown
}
