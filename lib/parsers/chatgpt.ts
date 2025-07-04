import puppeteer from 'puppeteer';
import type { Conversation } from '@/types/conversation';

/**
 * Scrapes only the conversation (user ↔ assistant) from a ChatGPT share URL,
 * with all stylesheets inlined.
 */
export async function parseChatGPT(url: string): Promise<Conversation> {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page    = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });

  // Inline all external stylesheets
  await page.evaluate(async () => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    for (const link of links) {
      try {
        const css   = await (await fetch(link.href)).text();
        const style = document.createElement('style');
        style.textContent = css;
        style.setAttribute('data-inlined-from', link.href);
        link.replaceWith(style);
      } catch { /* ignore failures */ }
    }
  });

  // Extract only the article bubbles and preserve head/styles
  const html = await page.evaluate(() => {
    const articles = Array.from(
      document.querySelectorAll('article[data-testid^="conversation-turn"]')
    );

    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '46rem';
    wrapper.style.margin   = '0 auto';
    articles.forEach(a => wrapper.appendChild(a.cloneNode(true)));

    const head = document.head.cloneNode(true);
    const body = document.createElement('body');
    body.appendChild(wrapper);

    const doc = document.implementation.createHTMLDocument('ChatGPT Conversation');
    doc.head.replaceWith(head);
    doc.body.replaceWith(body);

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  });

  await browser.close();

  return {
    model: 'ChatGPT',
    content: html,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(html),
  };
}
