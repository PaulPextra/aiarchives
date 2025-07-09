import type { Conversation } from '@/types/conversation';
import cheerio from 'cheerio';


export async function parseChatGPT(html: string): Promise<Conversation> {
  const $ = cheerio.load(html);
  const content = $('.\\@thread-xl\\/thread\\:pt-header-height.flex.flex-col.text-sm.pb-25');

  if (content.length === 0) {
    throw new Error('No conversation content found');
  }

  return {
    model: 'ChatGPT',
    content,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(html),
  };
}