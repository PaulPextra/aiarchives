import { JSDOM } from 'jsdom';

export async function inlineExternalStyles(html: string): Promise<Document> {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const links = Array.from(
    document.querySelectorAll('link[rel="stylesheet"]') as NodeListOf<HTMLLinkElement>
  );

  await Promise.all(
    links.map(async (link) => {
      const href = link.href;
      if (!href) return;

      try {
        const res = await fetch(href);
        const css = await res.text();

        const style = document.createElement('style');
        try {
          // Try applying CSS
          style.textContent = css;
          style.setAttribute('data-inlined-from', href.split('?')[0]);
          link.replaceWith(style);
        } catch (cssErr) {
          console.warn(`⚠️ Skipped CSS injection from: ${href}`, cssErr);
          // Leave link as-is or remove
          // link.remove(); // optional
        }
      } catch (fetchErr) {
        console.warn(`⚠️ Could not fetch CSS from ${href}`, fetchErr);
        // Leave link as-is or remove
        // link.remove(); // optional
      }
    })
  );

  return document;
}
