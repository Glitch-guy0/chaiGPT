import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import type { Role } from '@/types';
import { Conversation } from './conversation.entity';

export type MessageStatus = 'processing' | 'complete' | 'stopped';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  conversationId!: string;

  @Column()
  userId!: string;

  @Column({ nullable: true })
  parentId?: string;

  @Column({ type: 'varchar' })
  role!: Role;

  @Column({ type: 'text' })
  content!: string;

  @Column({ nullable: true })
  model?: string;

  @Column({ type: 'varchar' })
  status!: MessageStatus;

  @Column('simple-array', { nullable: true })
  assetIds?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Conversation, conversation => conversation.messages)
  @JoinColumn({ name: 'conversationId' })
  conversation?: Conversation;

  @ManyToOne(() => Message, message => message.siblings, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent?: Message;

  @OneToMany(() => Message, message => message.parent)
  siblings?: Message[];
}
