import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import type { Conversation } from '@/types/conversation';

export async function parseChatGPT(html: string): Promise<Conversation> {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // 1. ✅ Load chatgpt.css from assets folder
  const cssPath = path.resolve(process.cwd(), 'lib/parsers/assets/chatgpt.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  // 2. ✅ Create <style> tag and inject CSS
  const styleTag = document.createElement('style');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  // 3. 🎯 Continue with your normal scraping logic
  const chatBlocks = document.querySelectorAll(
    'div.markdown.prose.dark\\:prose-invert.w-full.break-words'
  );

  if (chatBlocks.length === 0) {
    throw new Error('Conversation blocks not found');
  }

  const htmlContent = `
    <html>
      <head>${document.head.innerHTML}</head>
      <body class="dark">
        ${Array.from(chatBlocks).map(el => el.outerHTML).join('\n')}
      </body>
    </html>
  `;

  return {
    model: 'ChatGPT',
    content: htmlContent,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: html.length,
  };
}
