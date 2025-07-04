import puppeteer from 'puppeteer';
import type { Conversation } from '@/types/conversation';

/**
 * Extract and return only the conversation content (article bubbles)
 * from a ChatGPT share page — all stylesheets are inlined.
 */
export async function parseChatGPT(url: string): Promise<Conversation> {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page    = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });

  // Inline all external stylesheets (<link rel="stylesheet"> → <style>)
  await page.evaluate(async () => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    for (const link of links) {
      try {
        const css   = await (await fetch(link.href)).text();
        const style = document.createElement('style');
        style.textContent = css;
        link.replaceWith(style);
      } catch { /* skip errors */ }
    }
  });

  // Only keep the <article> conversation bubbles
  const cropped = await page.evaluate(() => {
    const articles = Array.from(
      document.querySelectorAll('article[data-testid^="conversation-turn"]')
    );

    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '46rem';
    wrapper.style.margin = '0 auto';

    articles.forEach(a => wrapper.appendChild(a.cloneNode(true)));

    const docClone = document.cloneNode(true) as Document;
    docClone.body.innerHTML = '';
    docClone.body.appendChild(wrapper);

    return '<!DOCTYPE html>\n' + docClone.documentElement.outerHTML;
  });

  await browser.close();

  return {
    model: 'ChatGPT',
    content: cropped,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(cropped),
  };
}
