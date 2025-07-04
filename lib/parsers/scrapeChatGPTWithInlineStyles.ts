import puppeteer       from 'puppeteer';
import { JSDOM }       from 'jsdom';
import fs              from 'node:fs/promises';

/**
 * Selector that matches every chat bubble on a ChatGPT share page.
 * Tweak if OpenAI changes their markup.
 */
const ARTICLE_SEL = 'article[data-testid^="conversation-turn"]';

/**
 * Drive a ChatGPT **share URL** and return self-contained HTML that contains
 * **only** the <article> nodes (conversation turns) with all external
 * stylesheets inlined.
 */
export async function scrapeChatGPTWithInlineStyles(
  url: string,
  opts: { debugSaveFull?: string; debugSaveCropped?: string } = {}
): Promise<string> {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page    = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });

  /* Scroll to the bottom so lazy-loaded code blocks render */
  await page.evaluate(async () => {
    window.scrollTo({ top: document.body.scrollHeight });
    await new Promise(r => setTimeout(r, 500));
  });

  /* Inline every external <link rel="stylesheet"> */
  await page.evaluate(async () => {
    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
    );

    for (const link of links) {
      const href = link.href;
      if (!href) continue;

      try {
        const css   = await (await fetch(href)).text();
        const style = document.createElement('style');
        style.textContent = css;
        style.setAttribute('data-inlined-from', href.split('?')[0]);
        link.replaceWith(style);
      } catch { /* ignore failures */ }
    }
  });

  /* Grab the fully styled markup */
  const fullHtml = await page.content();
  if (opts.debugSaveFull) await fs.writeFile(opts.debugSaveFull, fullHtml);

  await browser.close();

  /* Crop the DOM to *only* the <article> nodes */
  const dom = new JSDOM(fullHtml);
  const { document } = dom.window;

  const main = document.createElement('main');
  document.querySelectorAll(ARTICLE_SEL).forEach(node =>
    main.appendChild(node.cloneNode(true))
  );

  const cropped =
    '<!DOCTYPE html>\n<html>' +
    document.head.outerHTML +
    '<body>' +
    main.outerHTML +
    '</body></html>';

  if (opts.debugSaveCropped) await fs.writeFile(opts.debugSaveCropped, cropped);

  return cropped;
}
