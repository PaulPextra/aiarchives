import type { Conversation } from '@/types/conversation';
import puppeteer             from 'puppeteer';
import { JSDOM }             from 'jsdom';

/** helper – replace every external stylesheet with an inline <style> tag */
async function inlineExternalStyles(html: string): Promise<string> {
  const dom      = new JSDOM(html);
  const document = dom.window.document;

  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
  );

  await Promise.all(
    links.map(async link => {
      const href = link.href;
      if (!href) return;

      try {
        const css = await (await fetch(href)).text();
        const style = document.createElement('style');
        style.textContent = css;
        style.setAttribute('data-inlined-from', href.split('?')[0]);
        link.replaceWith(style);
      } catch {
        /* if a sheet fails, keep the <link> so at worst it 404s online */
      }
    })
  );

  return dom.serialize();
}

/**
 * Scrape a ChatGPT share URL and return a Conversation whose
 * `styledHtml` is **visually identical** to the live page
 * (all class names preserved, all CSS inlined).
 */
export async function parseChatGPT(url: string): Promise<Conversation> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('parseChatGPT expects a full https:// share URL');
  }

  /* Headless visit */
  const browser = await puppeteer.launch({ headless: 'new' });
  const page    = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  /* Scroll so lazy content renders */
  await page.evaluate(async () => {
    window.scrollTo({ top: document.body.scrollHeight });
    await new Promise(r => setTimeout(r, 600));   // allow a tick
  });

  /* Grab markup & inline CSS */
  const rawHtml = await page.content();
  await browser.close();

  const styledHtml = await inlineExternalStyles(rawHtml);

  return {
    model : 'ChatGPT',
    content: styledHtml,
    scrapedAt : new Date().toISOString(),
    sourceHtmlBytes : Buffer.byteLength(styledHtml)
  } as Conversation;
}
