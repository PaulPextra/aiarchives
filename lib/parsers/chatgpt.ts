import type { Conversation } from '@/types/conversation';
import cheerio from 'cheerio';

/**
 * Extracts *only* the <div class="markdown prose …"> elements
 * from a ChatGPT share-page HTML string.
 *
 * @param rawHtml HTML of the whole share page (already fetched)
 * @returns      Conversation object whose `content` is the joined,
 *               styled HTML of every message body.
 */
export async function parseChatGPT(rawHtml: string): Promise<Conversation> {
  const $ = cheerio.load(rawHtml);

  /* 1️⃣  Remove action buttons & other chrome (optional) */
  $('[data-testid$="-turn-action-button"], button, svg').remove();

  /* 2️⃣  Grab every markdown body, keep original order            *
   *     – The long Tailwind class list sometimes changes.         *
   *     – `.markdown.prose` is the stable core we can rely on.    */
  const content = $('div.markdown.prose')
    .map((_, el) => $.html(el))    // outerHTML of each body
    .get()
    .join('\n');                   // concat with line-breaks

  if (!content.trim()) {
    throw new Error('No <div class="markdown prose …"> blocks found');
  }

  /* 3️⃣  Build the return object */
  return {
    model: 'ChatGPT',
    content,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(rawHtml)
  };
}