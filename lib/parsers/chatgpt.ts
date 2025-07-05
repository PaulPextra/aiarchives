import type { Conversation } from '@/types/conversation';
import puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';

/* ──────────────────────────────────────────────────────────────────────── */
/* 1) Scrape when the input is a URL                                        */
/* ──────────────────────────────────────────────────────────────────────── */
async function scrapeChatGPTWithInlineStyles(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page    = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  const html = await page.evaluate(() => {
    /* remove navbars / footers / buttons … */
    ['nav','header','footer','aside','button'].forEach(sel =>
      document.querySelectorAll(sel).forEach(e => e.remove())
    );

    /* inline every external <link rel="stylesheet"> */
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach(link => {
      const cssText = (link.sheet && Array.from(link.sheet.cssRules).map(r => r.cssText).join('\n')) || '';
      const style = document.createElement('style');
      style.textContent = cssText;
      link.replaceWith(style);
    });

    /* keep basic visual DNA of each bubble */
    document.querySelectorAll<HTMLElement>('[data-message-author-role]').forEach(b => {
      const cs  = window.getComputedStyle(b);
      b.setAttribute(
        'style',
        [
          `font:${cs.font}`,
          `padding:${cs.padding}`,
          `border-radius:${cs.borderRadius}`,
          /* colours are overridden later */
        ].join(';')
      );
    });

    return document.documentElement.outerHTML;
  });

  await browser.close();
  return html;
}

/* ──────────────────────────────────────────────────────────────────────── */
/* 2) Extract bubbles + apply the “sample” styling                          */
/* ──────────────────────────────────────────────────────────────────────── */
async function extractConversation(html: string): Promise<string> {
  const dom      = new JSDOM(html);
  const document = dom.window.document;

  const bubbles = Array
    .from(document.querySelectorAll<HTMLElement>('[data-message-author-role]'))
    .map(bubble => {
      const role         = bubble.getAttribute('data-message-author-role');
      const baseStyle    = bubble.getAttribute('style') ?? '';
      const shared       = 'max-width:70%;border-radius:1rem;';
      const userStyles   = 'background:#343541;color:#ececf1;margin-left:auto;';
      const asstStyles   = 'background:#dfe1e4;color:#202123;margin-right:auto;';

      bubble.setAttribute(
        'style',
        [
          shared,
          baseStyle,
          role === 'user' ? userStyles : asstStyles
        ].join('')
      );
      return bubble.outerHTML;
    })
    .join('\n');

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    :root { font-family: system-ui, "Open Sans", sans-serif; }
  </style>
</head>
<body style="margin:0;padding:2rem;display:flex;flex-direction:column;gap:1rem;">
  ${bubbles}
</body>
</html>
  `.trim();
}

/* ──────────────────────────────────────────────────────────────────────── */
/* 3) Public API                                                            */
/* ──────────────────────────────────────────────────────────────────────── */
export async function parseChatGPT(source: string): Promise<Conversation> {
  const isUrl   = /^https?:\/\//i.test(source);
  const rawHtml = isUrl ? await scrapeChatGPTWithInlineStyles(source) : source;
  const content = await extractConversation(rawHtml);

  return {
    model: 'ChatGPT',
    content,                           // HTML that looks like your sample
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(rawHtml),
  };
}
