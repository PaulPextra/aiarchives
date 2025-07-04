import { scrapeChatGPTWithInlineStyles } from '@/lib/parsers/scrapeChatGPTWithInlineStyles';
import type { Conversation }             from '@/types/conversation';
import { JSDOM }                         from 'jsdom';

/**
 *  ░▒▓█ Crop the HTML so **only the conversation bubbles remain** █▓▒░
 *  – keeps <html>/<head> intact so in-lined CSS variables still work –
 */
async function keepOnlyArticles(html: string): Promise<string> {
  const dom              = new JSDOM(html);
  const { document }     = dom.window;

  /* 1️⃣  Inline any leftover <link rel="stylesheet"> (raw HTML path) */
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  await Promise.all(
    links.map(async link => {
      try {
        const css   = await (await fetch(link.href)).text();
        const style = document.createElement('style');
        style.textContent = css;
        style.setAttribute('data-inlined-from', link.href.split('?')[0]);
        link.replaceWith(style);
      } catch {/* ignore network errors */ }
    })
  );

  /* 2️⃣  Collect the <article> bubbles we care about */
  const main      = document.querySelector('main') ?? document.body;
  const articles  = Array.from(
    main.querySelectorAll<HTMLElement>('article[data-testid^="conversation-turn"]')
  );

  /* 3️⃣  Replace <body> content with just those bubbles */
  const wrapper = document.createElement('div');
  wrapper.style.maxWidth = '46rem';
  wrapper.style.margin   = '0 auto';
  articles.forEach(a => wrapper.appendChild(a.cloneNode(true)));

  document.body.innerHTML = '';
  document.body.appendChild(wrapper);

  return dom.serialize();                   // <!DOCTYPE html> … fully styled
}

/* ─────────────────────────────────────────────────────────────────────────── */

export async function parseChatGPT(source: string): Promise<Conversation> {
  const isUrl   = /^https?:\/\//i.test(source);

  // 1. Get a *self-contained* page (all external CSS already in-lined)
  const rawHtml = isUrl
    ? await scrapeChatGPTWithInlineStyles(source)
    : source;

  // 2. Strip everything except the conversation turns
  const html = await keepOnlyArticles(rawHtml);

  return {
    model:           'ChatGPT',
    content:         html,                       // only <article> bubbles
    scrapedAt:       new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(html),
  };
}
