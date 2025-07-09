import type { Conversation } from '@/types/conversation';
import { JSDOM }             from 'jsdom';

export async function parseChatGPT(html: string): Promise<Conversation> {
  const dom       = new JSDOM(html);
  const document  = dom.window.document;
  const nodes = document.querySelectorAll(
    '.\\@thread-xl\\/thread\\:pt-header-height.flex.flex-col.text-sm.pb-25'
  );

  if (nodes.length === 0) {
    throw new Error('No conversation content found');
  }

  /* Build a single HTML string from those nodes */
  const content = Array.from(nodes)
    .map(el => el.outerHTML)
    .join('\n');

  return {
    model: 'ChatGPT',
    content,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(html)
  };
}