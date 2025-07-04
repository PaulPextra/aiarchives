// lib/parsers/chatgpt.ts
import { scrapeChatGPTWithInlineStyles } from '@/lib/parsers/scrapeChatGPTWithInlineStyles';
import type { Conversation } from '@/types/conversation';
import { JSDOM } from 'jsdom';

/** swap every <link rel="stylesheet"> for an inline <style> tag */
async function inlineExternalStyles(html: string): Promise<string> {
  console.log(html);
  const dom      = new JSDOM(html);
  const document = dom.window.document;

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
      } catch {/* ignore failures */ }
    })
  );

  return dom.serialize();
}

/**
 * Return only the styled HTML (no plain-text transcript).
 */
export async function parseChatGPT(source: string): Promise<Conversation> {
  const isUrl    = /^https?:\/\//i.test(source);
  const rawHtml  = isUrl ? await scrapeChatGPTWithInlineStyles(source) : source;
  const html     = await inlineExternalStyles(rawHtml);

  return {
    model: 'ChatGPT',
    content: html,                     // <── the single payload you want
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes : Buffer.byteLength(html)
  } as Conversation;
}
