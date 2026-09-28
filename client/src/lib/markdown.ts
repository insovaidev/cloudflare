import { marked } from 'marked'
import DOMPurify from 'dompurify'

// README text originates from scraped third-party pages via the AI model, so always sanitize.
export const renderMarkdown = (md: string) => {
  const html = marked.parse(md, { async: false, gfm: true }) as string
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
  // Open links in a new tab without leaking the opener.
  return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')
}
