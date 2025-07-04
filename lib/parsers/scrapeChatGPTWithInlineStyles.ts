import puppeteer       from 'puppeteer';
import { JSDOM }       from 'jsdom';
import fs              from 'node:fs/promises';

/** Chat bubble selector on a ChatGPT share page */
const ARTICLE_SEL = 'article[data-testid^="conversation-turn"]';

/**
 * Scrape a ChatGPT share URL, inline *external* stylesheets, and return
 * self-contained HTML that shows **only the user/assistant conversation**.
 */
export async function scrapeChatGPTWithInlineStyles(
  url: string,
  opts: { debugSaveFull?: string; debugSaveCropped?: string } = {}
): Promise<string> {
  /* Load the page & inline external <link rel="stylesheet"> */
  const browser = await puppeteer.launch({ headless: 'new' });
  const page    = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });

  /* Scroll once so lazy-loaded code blocks render */
  await page.evaluate(async () => {
    window.scrollTo({ top: document.body.scrollHeight });
    await new Promise(r => setTimeout(r, 500));
  });

  /* Inline every external stylesheet */
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
      } catch {/* ignore CORS / 404s */}
    }
  });

  const fullHtml = await page.content();                       // <— styled page
  if (opts.debugSaveFull) await fs.writeFile(opts.debugSaveFull, fullHtml);
  await browser.close();

  /* Crop BODY to keep **only** <article> bubbles */
  const dom       = new JSDOM(fullHtml);
  const { document } = dom.window;
  const body      = document.body;

  // Build a neat wrapper (optional – keeps max-width like the site)
  const wrapper = document.createElement('div');
  wrapper.style.maxWidth = '46rem';
  wrapper.style.margin   = '0 auto';

  document.querySelectorAll(ARTICLE_SEL).forEach(node =>
    wrapper.appendChild(node.cloneNode(true))
  );

  body.innerHTML = '';          // strip nav bars, footers, etc. but KEEP attrs
  body.appendChild(wrapper);    // inject only the conversation

  /* Serialise & return */
  const cropped = dom.serialize();    // <html> & <body> still intact
  if (opts.debugSaveCropped) await fs.writeFile(opts.debugSaveCropped, cropped);

  return cropped;
}
