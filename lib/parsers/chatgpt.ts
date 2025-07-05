import type { Conversation } from '@/types/conversation';
import puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';

/* ------------------------------------------------------------------------ */
/* 1) HEADLESS SCRAPER – only runs when the caller passes in a URL string   */
/* ------------------------------------------------------------------------ */
async function scrapeChatGPTWithInlineStyles(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page    = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });

  // Strip UI noise and inline every bubble’s computed style
  const html = await page.evaluate(() => {
    /** Helpers */
    const kill = (...sels: string[]) =>
      sels.forEach(sel =>
        document.querySelectorAll(sel).forEach(el => el.remove())
      );

    // 1️⃣ Remove everything except the conversation
    kill('nav', 'header', 'footer', 'aside', 'button', '[data-plaid-link-modal]');

    // 2️⃣ Inline <link rel="stylesheet"> → <style>
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach(link => {
      const cssText = (link.sheet && Array.from(link.sheet.cssRules).map(r => r.cssText).join('\n')) || '';
      const style   = document.createElement('style');
      style.textContent = cssText;
      link.replaceWith(style);
    });

    // 3️⃣ Inline the computed style of each bubble
    document.querySelectorAll('[data-message-author-role]').forEach(bubble => {
      const cs  = window.getComputedStyle(bubble);
      const css = [
        `color:${cs.color}`,
        `background-color:${cs.backgroundColor}`,
        `font:${cs.font}`,
        `padding:${cs.padding}`,
        `border-radius:${cs.borderRadius}`,
        `margin:${cs.margin}`
      ].join(';');
      bubble.setAttribute('style', css);
    });

    return document.documentElement.outerHTML;
  });

  await browser.close();
  return html;
}

/* ------------------------------------------------------------------------ */
/* 2) RAW-HTML PARSER – isolates the <article> bubbles and keeps styles     */
/* ------------------------------------------------------------------------ */
async function extractConversation(html: string): Promise<string> {
  const dom       = new JSDOM(html);
  const document  = dom.window.document;

  // Grab any CSS custom-prop declarations from the original <head>
  const headInner = document.querySelector('head')?.innerHTML ?? '';

  const bubbles = Array
    .from(document.querySelectorAll('[data-message-author-role]'))
    .map(node => (node as HTMLElement).outerHTML)       // preserves inline style
    .join('\n');

  return `
    <!doctype html>
    <html lang="en">
      <head>${headInner}</head>
      <body style="font-family:system-ui,sans-serif">
        ${bubbles}
      </body>
    </html>
  `.trim();
}

/* ------------------------------------------------------------------------ */
/* 3) PUBLIC API – accepts either a URL or raw HTML and returns a snapshot  */
/* ------------------------------------------------------------------------ */
export async function parseChatGPT(source: string): Promise<Conversation> {
  const isUrl    = /^https?:\/\//i.test(source);
  const rawHtml  = isUrl ? await scrapeChatGPTWithInlineStyles(source) : source;
  const content  = await extractConversation(rawHtml);

  return {
    model: 'ChatGPT',
    content,                      // → portable, self-contained HTML snippet
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(rawHtml),
  };
}
