import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm"

@Entity()
export class Asset {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  userId!: string

  @Column()
  conversationId!: string

  @Column()
  filename!: string

  @Column()
  mime!: string

  @Column()
  path!: string

  @CreateDateColumn()
  createdAt!: Date

  @ManyToOne("Conversation")
  @JoinColumn({ name: "conversationId" })
  conversation!: unknown
}
