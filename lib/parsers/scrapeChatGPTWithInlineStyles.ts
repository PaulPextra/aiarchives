// lib/scrapeChatGPTWithInlineStyles.ts
import puppeteer  from 'puppeteer';
import { JSDOM }  from 'jsdom';
import fs         from 'node:fs/promises';

const ARTICLE_SEL = 'article[data-testid^="conversation-turn"]';
const FONT_EXT    = /\.(woff2?|ttf|otf)(\?[^)]+)?$/i;

/* ─────────────────────────  STEP 1:  Render & inline external <link>  ───────────────────────── */
async function renderWithStylesheetsInlined(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page    = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  // force-paint lazy code blocks
  await page.evaluate(async () => {
    window.scrollTo({ top: document.body.scrollHeight });
    await new Promise(r => setTimeout(r, 500));
  });

  // swap every <link rel="stylesheet"> for an inline <style>
  await page.evaluate(async () => {
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    for (const link of links) {
      if (!link.href) continue;
      try {
        const css   = await (await fetch(link.href)).text();
        const style = document.createElement('style');
        style.textContent = css;
        style.setAttribute('data-inlined-from', link.href.split('?')[0]);
        link.replaceWith(style);
      } catch {/* ignore */}
    }
  });

  const html = await page.content();
  await browser.close();
  return html;
}

/* ───────────  STEP 2:  expand @import & embed font binaries as data-URIs  ─────────── */
async function inlineImportsAndFonts(fullHtml: string): Promise<string> {
  const dom          = new JSDOM(fullHtml);
  const { document } = dom.window;

  for (const style of Array.from(document.querySelectorAll<HTMLStyleElement>('style'))) {
    const baseHref = style.getAttribute('data-inlined-from') ?? document.baseURI;
    let css        = style.textContent ?? '';

    /* 2-A  expand @import … ;  (1-level deep is enough for ChatGPT sheets) */
    const importRe = /@import\s+(?:url\()?['"]?([^'")]+)['"]?\)?[^;]*;/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(css))) {
      try {
        const absUrl   = new URL(m[1], baseHref).href;
        const imported = await (await fetch(absUrl)).text();
        css = css.replace(m[0], imported);
      } catch {/* ignore */}
    }

    /* 2-B  embed font binaries */
    const urlRe = /url\((['"]?)([^'")]+)\1\)/g;
    const replacements: { from: string; to: string }[] = [];

    while ((m = urlRe.exec(css))) {
      const abs = new URL(m[2], baseHref).href;
      if (!FONT_EXT.test(abs)) continue;
      try {
        const buf   = Buffer.from(await (await fetch(abs)).arrayBuffer());
        const mime  = 'font/' + (abs.split('.').pop() ?? 'woff2');
        const data  = `url(data:${mime};base64,${buf.toString('base64')})`;
        replacements.push({ from: m[0], to: data });
      } catch {/* ignore */}
    }
    replacements.forEach(r => { css = css.split(r.from).join(r.to); });
    style.textContent = css;
  }
  return dom.serialize();
}

/* ───────────  STEP 3:  keep only the <article> bubbles  ─────────── */
function cropToConversation(fullHtml: string): string {
  const dom          = new JSDOM(fullHtml);
  const { document } = dom.window;

  const wrapper = document.createElement('div');
  wrapper.style.maxWidth = '46rem';
  wrapper.style.margin   = '0 auto';

  document.querySelectorAll(ARTICLE_SEL).forEach(a =>
    wrapper.appendChild(a.cloneNode(true))
  );

  document.body.innerHTML = '';
  document.body.appendChild(wrapper);
  return dom.serialize();
}

/* ───────────  PUBLIC API  ─────────── */
export async function scrapeChatGPTWithInlineStyles(
  url: string,
  opts: { debugSaveFull?: string; debugSaveCropped?: string } = {}
): Promise<string> {
  /* 1 */ const rendered   = await renderWithStylesheetsInlined(url);
  /* 2 */ const fontInlined= await inlineImportsAndFonts(rendered);
  if (opts.debugSaveFull)   await fs.writeFile(opts.debugSaveFull, fontInlined);

  /* 3 */ const cropped    = cropToConversation(fontInlined);
  if (opts.debugSaveCropped) await fs.writeFile(opts.debugSaveCropped, cropped);

  return cropped;
}
