import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { IAiProvider } from './provider';
import { Message } from '../db/entities/message.entity';
import { webSearchTool } from '../websearch/tool';

export class LangchainProvider implements IAiProvider {
  private model: ChatOpenAI;

  constructor(modelName: string = 'gpt-4o-mini') {
    this.model = new ChatOpenAI({
      modelName,
      openAIApiKey: process.env.OPENAI_API_KEY,
      streaming: true,
    });
  }

  private mapMessages(messages: Message[]): BaseMessage[] {
    return messages.map(m => {
      if (m.role === 'system') return new SystemMessage(m.content);
      if (m.role === 'assistant') return new AIMessage(m.content);
      return new HumanMessage(m.content);
    });
  }

  async complete(messages: Message[]): Promise<string> {
    const langchainMessages = this.mapMessages(messages);
    const response = await this.model.invoke(langchainMessages);
    return response.content.toString();
  }

  async streamChat(messages: Message[], onChunk: (chunk: string) => void): Promise<void> {
    const langchainMessages = this.mapMessages(messages);
    // For agent streaming, we'd use AgentExecutor, but since we are doing simple tool execution,
    // we can use tool binding. Since `.bindTools` type issues arose, we'll cast.
    const modelWithTools = this.model.bindTools([webSearchTool]);

    // First call to model
    const response = await modelWithTools.invoke(langchainMessages);

    // Check if tool call requested
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Execute tools (assuming only web_search for now)
      for (const tc of response.tool_calls) {
        if (tc.name === 'web_search') {
          // Add tool call message to history
          langchainMessages.push(response);

          const toolResult = await webSearchTool.invoke({ query: tc.args.query });
          // Add tool response to history
          langchainMessages.push({
            _getType: () => "tool",
            role: "tool",
            content: toolResult,
            tool_call_id: tc.id,
            name: tc.name
          } as any);
        }
      }

      // Stream final response
      const stream = await this.model.stream(langchainMessages);
      for await (const chunk of stream) {
        if (chunk.content) {
          onChunk(chunk.content.toString());
        }
      }
    } else {
      // No tools called, just stream directly
      const stream = await this.model.stream(langchainMessages);
      for await (const chunk of stream) {
        if (chunk.content) {
          onChunk(chunk.content.toString());
        }
      }
    }
  }
}

export const langChainService = new LangchainProvider();
