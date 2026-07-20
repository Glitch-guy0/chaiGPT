import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Conversation } from './conversation.entity';

export type Role = 'user' | 'assistant' | 'system';
export type MessageStatus = 'processing' | 'complete' | 'stopped';

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Conversation)
  @JoinColumn({ name: 'conversationId' })
  conversation!: Conversation;

  @Column({ type: 'uuid' })
  conversationId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent!: Message;

  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ type: 'varchar' })
  role!: Role;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', nullable: true })
  model!: string;

  @Column({ type: 'varchar' })
  status!: MessageStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
