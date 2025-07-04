import { scrapeChatGPTWithInlineStyles } from '@/lib/parsers/scrapeChatGPTWithInlineStyles';
import type { Conversation } from '@/types/conversation';
import { JSDOM } from 'jsdom';

async function prepRawHtml(html: string): Promise<string> {
  const dom       = new JSDOM(html);
  const { document } = dom.window;

  // 1-A Inline any external sheets that might still exist
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  await Promise.all(
    links.map(async link => {
      const href = link.href;
      if (!href) return;
      
      try {
        const css  = await (await fetch(href)).text();
        const tag  = document.createElement('style');
        tag.textContent = css;
        tag.setAttribute('data-inlined-from', href.split('?')[0]);
        link.replaceWith(tag);
      } catch { /* ignore */ }
    })
  );

  // 1-B Crop to only <article> bubbles to mirror scraper output
  const ARTICLE_SEL = 'article[data-testid^="conversation-turn"]';
  const main = document.createElement('main');
  document.querySelectorAll(ARTICLE_SEL).forEach(el =>
    main.appendChild(el.cloneNode(true))
  );

  return (
    '<!DOCTYPE html>\n<html>' +
    document.head.outerHTML +
    '<body>' +
    main.outerHTML +
    '</body></html>'
  );
}

export async function parseChatGPT(source: string): Promise<Conversation> {
  const isUrl   = /^https?:\/\//i.test(source);
  const html    = isUrl
    ? await scrapeChatGPTWithInlineStyles(source)
    : await prepRawHtml(source);

  return {
    model: 'ChatGPT',
    content: html,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(html),
  } as Conversation;
}
