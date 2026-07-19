import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from "typeorm"

@Entity()
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  userId!: string

  @Column({ nullable: true })
  rootConversationId?: string

  @ManyToOne("Conversation", { nullable: true })
  @JoinColumn({ name: "rootConversationId" })
  rootConversation?: Conversation

  @Column({ nullable: true })
  lastMessageId?: string

  @ManyToOne("Message", { nullable: true })
  @JoinColumn({ name: "lastMessageId" })
  lastMessage?: unknown

  @Column()
  title!: string

  @Column({ type: "varchar", default: "active" })
  status!: string

  @Column({ nullable: true })
  model?: string

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date

  @OneToMany("Message", "conversation")
  messages!: unknown[]
}
