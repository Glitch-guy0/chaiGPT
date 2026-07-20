import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Message } from './message.entity';

@Entity()
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne(() => Conversation, { nullable: true })
  @JoinColumn({ name: 'rootConversationId' })
  rootConversation!: Conversation;

  @Column({ type: 'uuid', nullable: true })
  rootConversationId!: string;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'lastMessageId' })
  lastMessage!: Message;

  @Column({ type: 'uuid', nullable: true })
  lastMessageId!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'varchar', nullable: true })
  model!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
