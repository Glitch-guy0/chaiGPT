import { Message } from '../db/entities/message.entity';

export interface IAiProvider {
  complete(messages: Message[]): Promise<string>;
  streamChat(messages: Message[], onChunk: (chunk: string) => void): Promise<void>;
}
