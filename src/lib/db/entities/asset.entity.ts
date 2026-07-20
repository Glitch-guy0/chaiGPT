import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  conversationId: string;

  @Column()
  filename: string;

  @Column()
  mime: string;

  @Column()
  path: string;

  @CreateDateColumn()
  createdAt: Date;
}
