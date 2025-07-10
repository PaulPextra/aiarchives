import type { Conversation } from '@/types/conversation';
import puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';


// Helper: inline all CSS from <link rel="stylesheet">
async function inlineExternalStyles(html: string): Promise<string> {
  const dom = new JSDOM(html);
const document = dom.window.document;

const links = Array.from(
  document.querySelectorAll('link[rel="stylesheet"]') as NodeListOf<HTMLLinkElement>
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
      // silently fail
    }
  })
);

  return dom.serialize();
}

// Main scraper
export async function parseChatGPT(url: string): Promise<Conversation> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('parseChatGPT expects a full https:// share URL');
  }

  const browser = await puppeteer.launch({ headless: true });
  const page    = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  // Ensure lazy content like code blocks loads
  await page.evaluate(async () => {
    window.scrollTo({ top: document.body.scrollHeight });
    await new Promise(r => setTimeout(r, 600));
  });

  const rawHtml = await page.content();
  await browser.close();

  const styledHtml = await inlineExternalStyles(rawHtml);

  return {
    model: 'ChatGPT',
    content: styledHtml,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(styledHtml),
  };
}
