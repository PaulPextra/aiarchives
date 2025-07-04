import type { Conversation } from '@/types/conversation';
import * as cheerio from 'cheerio';
import { inline } from 'css-inline';

/**
 * Scrapes only the conversation (user ↔ assistant) from a ChatGPT share URL,
 * with all stylesheets inlined, no navigation bar, and all buttons set to display: none.
 * @param html - The raw HTML string of the ChatGPT share page.
 * @returns A Promise resolving to a Conversation object containing the model, processed HTML content, scrape timestamp, and source HTML byte length.
 */
export async function parseChatGPT(html: string): Promise<Conversation> {
  try {
    // Load HTML into cheerio for parsing
    const $ = cheerio.load(html);

    // Remove all <nav> elements to hide navigation bar
    $('nav').remove();

    // Set display: none for all <button> elements
    $('button').css('display', 'none');

    // Select the user message container
    const userMessage = $('.relative.max-w-\\[var\\(--user-chat-width,70%\\)\\] .whitespace-pre-wrap');
    // Select the assistant response container
    const assistantMessage = $('.markdown.prose');

    if (userMessage.length === 0 && assistantMessage.length === 0) {
      throw new Error('No conversation messages found in the provided HTML.');
    }

    // Create a new container for the conversation
    const conversationHtml = $('<div class="chatgpt-conversation"></div>');

    // Append user message if present
    if (userMessage.length > 0) {
      const userDiv = $('<div class="user-message"></div>').append(userMessage.clone());
      conversationHtml.append(userDiv);
    }

    // Append assistant message if present
    if (assistantMessage.length > 0) {
      const assistantDiv = $('<div class="assistant-message"></div>').append(assistantMessage.clone());
      conversationHtml.append(assistantDiv);
    }

    // Extract all <style> tags from the original HTML (if any)
    let styles = $('style').map((_, el) => $(el).html()).get().join('\n');

    // Add rule to ensure buttons are hidden
    styles += `\nbutton { display: none !important; }`;

    // Add styles to the conversation HTML if present
    if (styles) {
      conversationHtml.prepend(`<style>${styles}</style>`);
    }

    // Convert the conversation HTML to a string
    let conversationHtmlString = $.html(conversationHtml);

    // Inline the styles using css-inline
    try {
      conversationHtmlString = await inline(conversationHtmlString, {
        remove_style_tags: true, // Remove original <style> tags after inlining
        extra_css: `
          .chatgpt-conversation { font-family: Arial, sans-serif; }
          .user-message { background-color: #f0f0f0; padding: 10px; border-radius: 15px; margin: 5px 0; }
          .assistant-message { background-color: #ffffff; padding: 10px; border-radius: 15px; margin: 5px 0; }
          button { display: none !important; }
        `, // Fallback styles, including button hiding
      });
    } catch (inlineError) {
      console.warn('Failed to inline styles:', inlineError);
      // Proceed with non-inlined styles if inlining fails
    }

    // Return the Conversation object
    return {
      model: 'ChatGPT',
      content: conversationHtmlString,
      scrapedAt: new Date().toISOString(),
      sourceHtmlBytes: Buffer.byteLength(html),
    };
  } catch (error) {
    throw new Error(`Failed to parse ChatGPT conversation: ${error.message}`);
  }
}