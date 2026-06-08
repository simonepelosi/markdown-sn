export function extractPreviewPlain(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')              // headings
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')  // bold / italic
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')    // underscore variants
    .replace(/~~([^~]+)~~/g, '$1')             // strikethrough
    .replace(/`{1,3}[^`]+`{1,3}/g, '')        // code
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1') // links / images
    .replace(/^[>\-*+] /gm, '')               // blockquotes / lists
    .replace(/\$\$[\s\S]*?\$\$/g, '')         // block math
    .replace(/\$[^$]+\$/g, '')               // inline math
    .replace(/\n{2,}/g, ' ')                 // collapse blank lines
    .trim()
    .slice(0, 200)
}
