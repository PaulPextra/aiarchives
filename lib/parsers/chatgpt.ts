import type { Conversation } from '@/types/conversation';
import { JSDOM } from 'jsdom';

/**
 * Helper to inline all external <link rel="stylesheet"> tags into <style> tags.
 */
async function inlineExternalStyles(html: string): Promise<Document> {
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
        style.textContent = css;
        style.setAttribute('data-inlined-from', href.split('?')[0]);
        link.replaceWith(style);
      } catch {
        // Silently fail
      }
    })
  );

  return document;
}

/**
 * Scrape and extract only the styled ChatGPT conversation blocks.
 * @param url A ChatGPT share URL (full or /share/xxx format)
 */
export async function parseChatGPT(url: string): Promise<Conversation> {
  // Normalize short format share URLs
  if (!/^https?:\/\//i.test(url)) {
    const cleaned = url.replace(/^\/?share\//, '');
    url = `https://chat.openai.com/share/${cleaned}`;
  }

  // Fetch the raw HTML from the share URL
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${url}`);
  }
  const rawHtml = await res.text();

  // Inline styles
  const document = await inlineExternalStyles(rawHtml);

  // Extract conversation blocks
  const conversationBlocks = Array.from(
    document.querySelectorAll('div.markdown.prose.dark\\:prose-invert.w-full.break-words')
  );

  if (conversationBlocks.length === 0) {
    throw new Error('Conversation content not found');
  }

  // Final output
  const htmlContent = `
    <html>
      <head>${document.head.innerHTML}</head>
      <body class="dark">
        ${conversationBlocks.map((block) => block.outerHTML).join('\n')}
      </body>
    </html>
  `;

  return {
    model: 'ChatGPT',
    content: htmlContent,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: Buffer.byteLength(htmlContent),
  };
}
