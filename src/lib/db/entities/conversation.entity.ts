import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { Message } from './message.entity';
import type { Asset } from './asset.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ nullable: true })
  rootConversationId?: string;

  @Column({ nullable: true })
  lastMessageId?: string;

  @Column()
  title!: string;

  @Column({ nullable: true })
  model?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany('Message', (message: Message) => message.conversation)
  messages?: Message[];

  @OneToMany('Asset', (asset: Asset) => asset.conversation)
  assets?: Asset[];
}
