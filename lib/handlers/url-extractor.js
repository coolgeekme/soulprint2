/**
 * URL Content Extraction — Web scraping and URL content fetching
 * Extracted from the main catch-all route.js for maintainability.
 */

// ============================================================
// URL CONTENT EXTRACTION
// ============================================================

// Extract readable text content from a URL
async function extractUrlContent(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SoulPrintBot/1.0; +https://soulprint.ai)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { success: false, error: 'Not a readable page (PDF, image, or other binary content)' };
    }
    
    const html = await res.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : '';
    
    // Extract Open Graph data
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : '';
    
    // Remove script, style, nav, header, footer, aside tags and their content
    let cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');
    
    // Try to find main content area
    const articleMatch = cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const contentDiv = cleanHtml.match(/<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    
    let mainContent = articleMatch?.[1] || mainMatch?.[1] || contentDiv?.[1] || cleanHtml;
    
    // Extract text from HTML
    let text = mainContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // Limit content length
    const maxLength = 8000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...\n\n[Content truncated]';
    }
    
    return {
      success: true,
      url,
      title: ogTitle || title,
      description,
      content: text,
      contentLength: text.length,
    };
  } catch (e) {
    if (e.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    return { success: false, error: e.message };
  }
}

// Detect URLs in text
function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  return text.match(urlRegex) || [];
}


export {
  extractUrlContent,
  extractUrls,
};
