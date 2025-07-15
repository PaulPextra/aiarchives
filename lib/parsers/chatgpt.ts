import { chromium } from 'playwright';
import type { Conversation } from '@/types/conversation';

/**
 * Scrape and extract only the styled ChatGPT conversation blocks using Playwright.
 * @param url A ChatGPT share URL (full or /share/xxx format)
 */
export async function parseChatGPT(url: string): Promise<Conversation> {
  // Normalize short format share URLs like "/share/abc123"
  if (!/^https?:\/\//i.test(url)) {
    const cleaned = url.replace(/^\/?share\//, '');
    url = `https://chat.openai.com/share/${cleaned}`;
  }

  // Launch headless Chromium
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for content to load
  await page.waitForSelector('div.markdown.prose.dark\\:prose-invert.w-full.break-words');

  // Extract necessary styled content
  const htmlContent = await page.evaluate(() => {
    const head = document.head.innerHTML;
    const blocks = Array.from(
      document.querySelectorAll('div.markdown.prose.dark\\:prose-invert.w-full.break-words')
    );
    const body = blocks.map(el => el.outerHTML).join('\n');

    return `
      <html>
        <head>${head}</head>
        <body class="dark">
          ${body}
        </body>
      </html>
    `;
  });

  await browser.close();

  return {
    model: 'ChatGPT',
    content: htmlContent,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(htmlContent),
  };
}
