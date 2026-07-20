import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  conversationId!: string;

  @Column()
  filename!: string;

  @Column()
  mime!: string;

  @Column()
  path!: string;

  @Column({ type: 'text', nullable: true })
  text?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Conversation, conversation => conversation.assets)
  @JoinColumn({ name: 'conversationId' })
  conversation?: Conversation;
}
