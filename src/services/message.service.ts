import { Message } from "@/lib/db/entities/message.entity"

export interface MessageService {
  append(convId: string, userId: string, content: string): Promise<Message>
  editLatest(userId: string, convId: string, content: string): Promise<Message>
}
