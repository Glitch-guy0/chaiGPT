import { Conversation } from '../entities/conversation.entity';
import { Message, Role, MessageStatus } from '../entities/message.entity';
import { Asset } from '../entities/asset.entity';

export const createConversationFixture = (overrides?: Partial<Conversation>): Conversation => {
  const c = new Conversation();
  c.id = 'uuid-conv-1';
  c.userId = 'user-1';
  c.title = 'Test Conv';
  c.createdAt = new Date();
  c.updatedAt = new Date();
  if (overrides) Object.assign(c, overrides);
  return c;
};

export const createMessageFixture = (overrides?: Partial<Message>): Message => {
  const m = new Message();
  m.id = 'uuid-msg-1';
  m.conversationId = 'uuid-conv-1';
  m.userId = 'user-1';
  m.role = 'user';
  m.content = 'Hello';
  m.status = 'complete';
  m.createdAt = new Date();
  if (overrides) Object.assign(m, overrides);
  return m;
};

export const createAssetFixture = (overrides?: Partial<Asset>): Asset => {
  const a = new Asset();
  a.id = 'uuid-asset-1';
  a.userId = 'user-1';
  a.conversationId = 'uuid-conv-1';
  a.filename = 'test.txt';
  a.mime = 'text/plain';
  a.path = '/vol/test.txt';
  a.createdAt = new Date();
  if (overrides) Object.assign(a, overrides);
  return a;
};
