import { JSDOM } from 'jsdom';

/**
 * Pass in the FULL HTML of a ChatGPT share page.
 * Returns a string that still contains the <html>, <head>, and *only*
 * the conversation <article> nodes – with CSS links in-lined so it
 * looks identical when you open the file.
 */
export async function extractConversation(html: string): Promise<string> {
  /* 1 ░░ Parse once with JSDOM */
  const dom          = new JSDOM(html);
  const { document } = dom.window;

  /* 2 ░░ Inline every <link rel="stylesheet"> while we still have them */
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
  );

  await Promise.all(
    links.map(async link => {
      if (!link.href) return;
      try {
        /* fetch → text → replace the link with an inline <style> tag */
        const css   = await (await fetch(link.href)).text();
        const style = document.createElement('style');
        style.textContent = css;
        style.setAttribute('data-inlined-from', link.href.split('?')[0]);
        link.replaceWith(style);
      } catch {
        /* network / CORS failure? – just keep the original link */
      }
    })
  );

  /* 3 ░░ Collect the conversation bubbles */
  const main      = document.querySelector('main') ?? document.body;
  const bubbles   = main.querySelectorAll<HTMLElement>(
    'article[data-testid^="conversation-turn"]'
  );

  /* 4 ░░ Replace <body> content with just those bubbles */
  const wrapper = document.createElement('div');
  wrapper.style.maxWidth = '46rem';   // same centred width ChatGPT uses
  wrapper.style.margin   = '0 auto';
  bubbles.forEach(b => wrapper.appendChild(b.cloneNode(true)));

  document.body.innerHTML = '';       // strip navbars, footer, etc.
  document.body.appendChild(wrapper); // inject conversation only

  /* 5 ░░ Serialize back to a complete HTML document */
  return dom.serialize();             // <!DOCTYPE html>… with styles
}
