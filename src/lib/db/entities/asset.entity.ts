import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity()
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne(() => Conversation)
  @JoinColumn({ name: 'conversationId' })
  conversation!: Conversation;

  @Column({ type: 'uuid' })
  conversationId!: string;

  @Column({ type: 'varchar' })
  filename!: string;

  @Column({ type: 'varchar' })
  mime!: string;

  @Column({ type: 'varchar' })
  path!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
