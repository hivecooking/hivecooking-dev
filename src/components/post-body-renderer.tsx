'use client';

import { useMemo } from 'react';

function extractYoutubeVideoId(url: string): string | null {
  try {
    const cleaned = url.trim().replace(/\\([\\`*_{}[\]()#+\-.!~:])/g, '$1');
    const watchMatch = cleaned.match(
      /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})(?:[&?][^\s<]*)?$/i,
    );
    return watchMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

function unescapeMarkdownEscapes(text: string): string {
  return text.replace(/\\([\\`*_{}[\]()#+\-.!~:])/g, '$1');
}

function renderMarkdownToHtml(raw: string): string {
  let html = raw.replace(/\r\n/g, '\n');

  // Strip script/style/object/embed tags from untrusted markdown for safety
  html = html.replace(/<(script|style|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Convert markdown images ![alt](url)
  html = html.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    '<img src="$2" alt="$1" class="my-4 max-h-[520px] w-auto object-contain mx-auto" loading="lazy" />',
  );

  // Convert markdown links [text](url) — rewrite waivio.com/hivecooking.com /object/ links to local relative paths
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, rawUrl: string) => {
    const cleanUrl = unescapeMarkdownEscapes(rawUrl);
    const localObjMatch = cleanUrl.match(
      /^https?:\/\/(?:www\.)?(?:waivio\.com|hivecooking\.com)\/object\/([^\s/?#]+)/i,
    );
    if (localObjMatch?.[1]) {
      return `<a href="/object/${localObjMatch[1]}" class="text-[#af3d36] hover:underline">${unescapeMarkdownEscapes(label)}</a>`;
    }
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-[#af3d36] hover:underline">${unescapeMarkdownEscapes(label)}</a>`;
  });

  // Convert headings (only unescaped # at start of line)
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^\\*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  // Split by double newlines into blocks matching Waivio's Body--full paragraph generator
  const blocks = html.split(/\n{2,}/);
  const renderedBlocks: string[] = [];

  for (const rawBlock of blocks) {
    const trimmed = rawBlock.trim();
    if (!trimmed) continue;

    // Standalone YouTube URL block -> inline PostFeedEmbed__container--youtube with surrounding <p><br></p>
    const ytId = extractYoutubeVideoId(trimmed);
    if (ytId) {
      renderedBlocks.push('<p class="mb-[16px]"><br /></p>');
      renderedBlocks.push(
        `<div class="PostFeedEmbed__container PostFeedEmbed__container--youtube relative mb-[16px] w-full pb-[56%]"><iframe width="100%" height="400" src="https://www.youtube.com/embed/${ytId}?autoplay=false" frameborder="0" scrolling="no" allowfullscreen class="absolute top-0 left-0 h-full w-full border-0"></iframe></div>`,
      );
      renderedBlocks.push('<p class="mb-[16px]"><br /></p>');
      continue;
    }

    let unescaped = unescapeMarkdownEscapes(trimmed);

    // Autolink bare https:// URLs that aren't already inside href="..." or >...<
    unescaped = unescaped.replace(
      /(^|[\s(])(https?:\/\/[^\s<)"']+?)([.,;!?)]?(?=\s|$))/g,
      '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#af3d36] hover:underline">$2</a>$3',
    );

    // Autolink #hashtags (e.g. #carbonara)
    unescaped = unescaped.replace(
      /(^|\s)#([a-zA-Z0-9_-]+)/g,
      '$1<a href="/object/$2" class="text-[#af3d36] hover:underline">#$2</a>',
    );

    if (/^<(h[1-6]|ul|ol|li|div|p|img|blockquote|hr|table|iframe)/i.test(unescaped)) {
      renderedBlocks.push(unescaped);
    } else {
      renderedBlocks.push(`<p class="mb-[16px] leading-[30px]">${unescaped.replace(/\n/g, '<br />')}</p>`);
    }
  }

  return renderedBlocks.join('\n');
}

export function PostBodyRenderer({ body }: { body: string }) {
  const renderedHtml = useMemo(() => renderMarkdownToHtml(body), [body]);

  return (
    <div
      className="Body Body--full px-0 pt-[15px] pb-[18px] font-['Source_Serif_Pro',serif] text-[20px] leading-[30px] font-normal text-[rgba(0,0,0,0.84)] md:px-[12px] md:pt-0 [&_a]:text-[#af3d36] [&_b]:text-black [&_strong]:text-black"
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
