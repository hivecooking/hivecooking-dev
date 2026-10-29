'use client';

import { useMemo } from 'react';

function renderMarkdownToHtml(raw: string): string {
  let html = raw;

  // Strip script/style/iframe tags from untrusted markdown for safety
  html = html.replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Convert markdown images ![alt](url)
  html = html.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    '<img src="$2" alt="$1" class="my-4 max-h-[520px] w-auto rounded-card object-contain mx-auto shadow-xs" loading="lazy" />',
  );

  // Convert markdown links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent underline hover:opacity-80">$1</a>',
  );

  // Convert headings
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="mt-5 mb-2 font-semibold text-fg">$1</h4>');
  html = html.replace(
    /^###\s+(.+)$/gm,
    '<h3 class="mt-6 mb-2 text-lg font-bold text-fg">$1</h3>',
  );
  html = html.replace(
    /^##\s+(.+)$/gm,
    '<h2 class="mt-7 mb-3 text-xl font-bold text-fg border-b border-border pb-1">$1</h2>',
  );
  html = html.replace(
    /^#\s+(.+)$/gm,
    '<h1 class="mt-7 mb-3 text-2xl font-bold text-fg">$1</h1>',
  );

  // Bold & italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  // Bullet list items
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-5 list-disc py-0.5">$1</li>');

  // Convert double newlines to paragraph breaks
  const blocks = html.split(/\n{2,}/);
  return blocks
    .map((b) => {
      const trimmed = b.trim();
      if (!trimmed) return '';
      if (/^<(h[1-6]|ul|ol|li|div|p|img|blockquote|hr|table)/i.test(trimmed)) {
        return trimmed;
      }
      return `<p class="my-3 leading-relaxed">${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');
}

export function PostBodyRenderer({ body }: { body: string }) {
  const renderedHtml = useMemo(() => renderMarkdownToHtml(body), [body]);

  return (
    <div
      className="prose max-w-none text-body text-fg [&_a]:text-accent [&_a]:underline [&_img]:mx-auto [&_img]:my-4 [&_img]:max-h-[520px] [&_img]:rounded-card"
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
