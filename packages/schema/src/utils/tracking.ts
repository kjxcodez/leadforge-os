/**
 * LeadForge OS — Email Tracking, Link Rewriting & Preview Security Utilities
 *
 * Provides:
 * 1. Opaque tracking token generation (cryptographically secure, zero PII)
 * 2. 1x1 transparent open tracking pixel injection
 * 3. Safe outbound link rewriting for click tracking with strict exclusions
 * 4. Lightweight HTML sanitization for safe desktop preview
 */

import crypto from 'crypto';

/**
 * Generates an opaque, non-guessable tracking token (32 hex characters / 128 bits entropy).
 * Contains no PII, user IDs, or database identifiers.
 */
export function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Injects a 1x1 transparent open-tracking pixel into an outbound HTML message.
 * Places the pixel right before </body> if present, or appends to the HTML.
 */
export function injectOpenTrackingPixel(
  html: string,
  trackingBaseUrl: string,
  openToken: string
): string {
  if (!html || !openToken) return html;

  const normalizedBase = trackingBaseUrl.replace(/\/+$/, '');
  const pixelUrl = `${normalizedBase}/t/open/${openToken}`;
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;border:0;" />`;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixelTag}</body>`);
  }
  return `${html}\n${pixelTag}`;
}

export interface ClickTrackingRewriteResult {
  rewrittenHtml: string;
  tokens: Array<{ token: string; targetUrl: string }>;
}

/**
 * Rewrites outbound HTML links for click tracking.
 * Strictly excludes:
 * - mailto: URIs
 * - tel: URIs
 * - Fragment/anchor links (#...)
 * - Explicit no-track tags (data-no-track="true" or class="leadforge-no-track")
 * - Unsubscribe placeholders or links containing unsubscribe
 */
export function rewriteLinksForClickTracking(
  html: string,
  trackingBaseUrl: string,
  customTokenGenerator?: () => string
): ClickTrackingRewriteResult {
  if (!html) {
    return { rewrittenHtml: html, tokens: [] };
  }

  const normalizedBase = trackingBaseUrl.replace(/\/+$/, '');
  const tokens: Array<{ token: string; targetUrl: string }> = [];
  const tokenGen = customTokenGenerator || generateTrackingToken;

  // Regex matching <a ... href="..." ...>
  const linkRegex = /<a\b([^>]*?)href=(["'])(.*?)\2([^>]*?)>/gi;

  const rewrittenHtml = html.replace(linkRegex, (fullMatch, beforeHref, quote, rawHref, afterHref) => {
    const trimmedHref = rawHref.trim();

    // 1. Exclusion: mailto: or tel:
    if (/^(mailto:|tel:)/i.test(trimmedHref)) {
      return fullMatch;
    }

    // 2. Exclusion: fragment-only anchor links
    if (trimmedHref.startsWith('#') || trimmedHref === '') {
      return fullMatch;
    }

    // 3. Exclusion: non-http(s) schemes (e.g. javascript:, data:, file:)
    if (!/^https?:\/\//i.test(trimmedHref)) {
      return fullMatch;
    }

    // 4. Exclusion: data-no-track or unsubscribe links
    const combinedAttrs = `${beforeHref} ${afterHref}`.toLowerCase();
    if (
      combinedAttrs.includes('data-no-track') ||
      combinedAttrs.includes('leadforge-no-track') ||
      combinedAttrs.includes('leadforge-unsubscribe') ||
      trimmedHref.includes('unsubscribe')
    ) {
      return fullMatch;
    }

    // 5. Generate opaque token and construct tracking URL
    const token = tokenGen();
    tokens.push({ token, targetUrl: trimmedHref });
    const trackingUrl = `${normalizedBase}/t/click/${token}`;

    return `<a${beforeHref}href=${quote}${trackingUrl}${quote}${afterHref}>`;
  });

  return { rewrittenHtml, tokens };
}

/**
 * Sanitizes stored email HTML for secure desktop rendering in an isolated preview container.
 * Strips script tags, objects, embeds, iframes, and inline on* event handlers.
 */
export function sanitizeHtmlForPreview(rawHtml: string): string {
  if (!rawHtml) return '';

  let sanitized = rawHtml;

  // 1. Strip <script>...</script>
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Strip <object>, <embed>, <applet>
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '');

  // 3. Strip <iframe>
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // 4. Strip inline on* event handlers (e.g. onload, onerror, onclick)
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '');

  // 5. Neutralize javascript: and vbscript: URIs
  sanitized = sanitized.replace(/href\s*=\s*(["'])\s*(javascript|vbscript):/gi, 'href=$1#blocked-');
  sanitized = sanitized.replace(/src\s*=\s*(["'])\s*(javascript|vbscript):/gi, 'src=$1#blocked-');

  return sanitized;
}
