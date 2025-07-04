// app/api/conversation/scrapeAndInlineStyles.ts
//------------------------------------------------
import puppeteer from 'puppeteer';

/**
 * Drive a ChatGPT **share** URL and return self-contained HTML:
 *   • React is fully rendered (we scroll to the bottom)
 *   • every <link rel="stylesheet"> is inlined as <style>…</style>
 *   • you get one big HTML string you can save or parse further
 */
export async function scrapeChatGPTWithInlineStyles(
  url: string
): Promise<string> {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page    = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });

  // ── 1) Scroll so lazy elements render ─────────────────────────
  await page.evaluate(async () => {
    window.scrollTo({ top: document.body.scrollHeight });
    await new Promise(r => setTimeout(r, 500));          // wait a tick
  });

  // ── 2) Inline external style-sheets ───────────────────────────
  await page.evaluate(async () => {
    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
    );

    for (const link of links) {
      const href = link.href;
      if (!href) continue;

      try {
        const css = await (await fetch(href)).text();
        const style = document.createElement('style');
        style.textContent = css;
        style.setAttribute('data-inlined-from', href.split('?')[0]);
        link.replaceWith(style);
      } catch { /* ignore if a sheet fails */ }
    }
  });

  // ── 3) Grab the fully-styled markup ───────────────────────────
  const html = await page.content();
  await browser.close();
  return html;
}
