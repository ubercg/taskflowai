import React from 'react';

/**
 * URL regex: matches http://, https://, or www. prefixed URLs.
 * Note: the `g` flag makes split() work correctly to interleave text
 * and URL segments. A new RegExp is created per call to avoid lastIndex
 * state issues across renders.
 */
const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/;

/**
 * Characters that should be stripped from the end of a matched URL.
 * Common trailing punctuation that closes a sentence but is not part of the URL.
 */
const TRAILING_PUNCTUATION = /[.,;:!?)>\]]+$/;

/**
 * Strips common trailing punctuation from a URL string.
 * @param {string} url - The raw matched URL string
 * @returns {string} - The cleaned URL without trailing punctuation
 */
function stripTrailingPunctuation(url) {
  return url.replace(TRAILING_PUNCTUATION, '');
}

/**
 * Builds the href for a matched URL.
 * www. URLs get an https:// prefix so they are navigable.
 * @param {string} cleanUrl - The cleaned URL (no trailing punctuation)
 * @returns {string} - The href value
 */
function buildHref(cleanUrl) {
  if (cleanUrl.startsWith('www.')) {
    return `https://${cleanUrl}`;
  }
  return cleanUrl;
}

/**
 * Determines whether a string segment is a URL (http, https, or www. prefixed).
 * @param {string} segment
 * @returns {boolean}
 */
function isUrl(segment) {
  return URL_PATTERN.test(segment);
}

/**
 * Linkify — renders a text string with any http/https/www. URLs replaced
 * by clickable <a> elements that open in a new tab.
 *
 * XSS-safe: no dangerouslySetInnerHTML. Splits on a regex and maps to
 * React elements.
 *
 * @param {{ text: string | null | undefined }} props
 */
function Linkify({ text }) {
  if (!text) return null;

  // Using a capturing group in the pattern ensures split() includes the
  // captured URL segments in the returned array (interleaved with text).
  const parts = text.split(URL_PATTERN);

  if (parts.length === 1) {
    // No URLs found — plain text, single element
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, index) => {
        if (!isUrl(part)) {
          return part;
        }

        const cleanUrl = stripTrailingPunctuation(part);
        const trailingText = part.slice(cleanUrl.length);
        const href = buildHref(cleanUrl);

        return (
          <React.Fragment key={index}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: '#6366f1', textDecoration: 'underline' }}
            >
              {cleanUrl}
            </a>
            {trailingText}
          </React.Fragment>
        );
      })}
    </>
  );
}

export default Linkify;
