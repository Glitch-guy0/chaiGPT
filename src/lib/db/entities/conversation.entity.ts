import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"

@Entity()
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column()
  title!: string

  @Column({ nullable: true })
  model?: string

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date

  @OneToMany("Message", "conversation")
  messages!: unknown[]
}
