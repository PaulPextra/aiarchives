import { scrapeChatGPTWithInlineStyles } from '@/lib/parsers/scrapeChatGPTWithInlineStyles';
import type { Conversation }             from '@/types/conversation';
import { JSDOM }                         from 'jsdom';

/**
 *  Trim pasted /raw HTML down to just the <article> turns and inline any
 *  remaining external stylesheets.  (We call this only for *non-URL* input
 *  because scrapeChatGPTWithInlineStyles already returns bubbles-only.)
 */
async function keepOnlyArticles(html: string): Promise<string> {
  const dom          = new JSDOM(html);
  const { document } = dom.window;

  /* 1. Any leftover <link rel="stylesheet"> → inline <style> */
  await Promise.all(
    Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
      .map(async link => {
        try {
          const css   = await (await fetch(link.href)).text();
          const style = document.createElement('style');
          style.textContent = css;
          style.setAttribute('data-inlined-from', link.href.split('?')[0]);
          link.replaceWith(style);
        } catch { /* ignore CORS / 404 */ }
      })
  );

  /* 2. Keep only the conversation bubbles */
  const articles = Array.from(
    (document.querySelector('main') ?? document.body)
      .querySelectorAll<HTMLElement>('article[data-testid^="conversation-turn"]')
  );

  const wrapper = document.createElement('div');
  wrapper.style.maxWidth = '46rem';
  wrapper.style.margin   = '0 auto';
  articles.forEach(a => wrapper.appendChild(a.cloneNode(true)));

  document.body.innerHTML = '';
  document.body.appendChild(wrapper);

  return dom.serialize();         // <!DOCTYPE html> … fully styled
}

/* ─────────────────────────────────────────────────────────────────────────── */

export async function parseChatGPT(source: string): Promise<Conversation> {
  const isUrl = /^https?:\/\//i.test(source);

  // For share-page URLs we now rely entirely on the helper, which already:
  //  • loads the page in Puppeteer
  //  • inlines <link> CSS (and optionally fonts)
  //  • crops <body> to only the conversation container
  //
  // For raw/pasted HTML we still need to inline & crop locally.
  const html = isUrl
    ? await scrapeChatGPTWithInlineStyles(source)    // bubbles-only, ready
    : await keepOnlyArticles(source);                // still needs trimming

  return {
    model:           'ChatGPT',
    content:         html,
    scrapedAt:       new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(html),
  } as Conversation;
}
