import type { Conversation } from '@/types/conversation';
import cheerio from 'cheerio';


export async function parseChatGPT(html: string): Promise<Conversation> {
  const $ = cheerio.load(html);
  const conversationContent = $('.markdown.prose.dark\\:prose-invert.w-full.break-words');

  if (conversationContent.length === 0) {
    throw new Error('No conversation content found');
  }

  const content = conversationContent.html().trim();

  return {
    model: 'ChatGPT',
    content,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(rawHtml),
  };
}