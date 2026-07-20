import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Message } from './message.entity';
import { Asset } from './asset.entity';

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

  @OneToMany(() => Message, message => message.conversation)
  messages?: Message[];

  @OneToMany(() => Asset, asset => asset.conversation)
  assets?: Asset[];
}
