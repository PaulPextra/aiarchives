import { scrapeChatGPTWithInlineStyles } from '@/lib/parsers/scrapeChatGPTWithInlineStyles';
import type { Conversation }             from '@/types/conversation';
import { JSDOM }                         from 'jsdom';

async function prepRawHtml(html: string): Promise<string> {
  const dom        = new JSDOM(html);
  const { document } = dom.window;
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  await Promise.all(
    links.map(async link => {
      const href = link.href;
      if (!href) return;

      try {
        const css   = await (await fetch(href)).text();
        const style = document.createElement('style');
        style.textContent = css;
        style.setAttribute('data-inlined-from', href.split('?')[0]);
        link.replaceWith(style);
      } catch { /* ignore failures */ }
    })
  );

  /* Keep **only** the <article> bubbles, but preserve <html>/<body> */
  const ARTICLE_SEL = 'article[data-testid^="conversation-turn"]';
  const wrapper     = document.createElement('div');
  wrapper.style.maxWidth = '46rem';
  wrapper.style.margin   = '0 auto';

  document.querySelectorAll(ARTICLE_SEL).forEach(el =>
    wrapper.appendChild(el.cloneNode(true))
  );

  document.body.innerHTML = '';
  document.body.appendChild(wrapper);

  /* Return fully-serialised HTML (doctype, <head>, attrs all intact) */
  return dom.serialize();
}

export async function parseChatGPT(source: string): Promise<Conversation> {
  const isUrl = /^https?:\/\//i.test(source);

  const html  = isUrl
    ? await scrapeChatGPTWithInlineStyles(source)
    : await prepRawHtml(source);
  return {
    model: 'ChatGPT',
    content: html,               
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(html),
  } as Conversation;
}
