import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import type { Role } from '@/types';

export type MessageStatus = 'processing' | 'complete' | 'stopped';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  parentId?: string;

  @Column({ type: 'varchar' })
  role: Role;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  model?: string;

  @Column({ type: 'varchar' })
  status: MessageStatus;

  @CreateDateColumn()
  createdAt: Date;
}
