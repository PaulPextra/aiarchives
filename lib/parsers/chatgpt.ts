import { extractConversation } from '@/lib/stripChatConversation';
import type { Conversation }   from '@/types/conversation';

export async function parseChatGPT(sourceHtml: string): Promise<Conversation> {
  const content = await extractConversation(sourceHtml);

  return {
    model: 'ChatGPT',
    content,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(content),
  };
}