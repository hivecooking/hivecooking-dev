const GOVERNANCE_ID = "governance-31abe670";
const DEFAULT_IMAGE =
  "https://waivio.nyc3.digitaloceanspaces.com/1710780850_d2cf8133-eafd-4098-8280-49354a2e6a34";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function callMcp(name, args) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const resp = await fetch("https://waiviodev.com/query/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name,
          arguments: {
            locale: "en-US",
            governance_object_id: GOVERNANCE_ID,
            ...args,
          },
        },
      }),
      signal: controller.signal,
    });
    const json = await resp.json();
    if (json.error || json.result?.isError) return null;
    const text = json.result?.content?.[0]?.text;
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveSeoMeta(url) {
  const norm = url.pathname.replace(/\/+$/, "") || "/";
  const canonicalUrl = `${url.origin}${norm}`;

  // 1. /object/<objectId>
  const objMatch = norm.match(/^\/object\/([^/]+)/);
  if (objMatch?.[1]) {
    const objectId = decodeURIComponent(objMatch[1]);
    const obj = await callMcp("resolve_object", { object_id: objectId });
    if (!obj) return null;
    const name = obj.fields?.name || objectId;
    const desc =
      obj.fields?.description ||
      obj.fields?.title ||
      `Explore ${name} (${obj.object_type}) on HiveCooking.com.`;
    const image = obj.fields?.image || obj.fields?.avatar || DEFAULT_IMAGE;
    const isRecipe = obj.object_type === "recipe";
    const ingredients = Array.isArray(obj.fields?.ingredients)
      ? obj.fields.ingredients
      : Array.isArray(obj.fields?.recipeIngredients)
        ? obj.fields.recipeIngredients
        : [];

    const jsonLd = isRecipe
      ? {
          "@context": "https://schema.org",
          "@type": "Recipe",
          name,
          description: String(desc).slice(0, 300),
          image: [image],
          recipeIngredient: ingredients,
        }
      : null;

    return {
      title: `${name} | HiveCooking.com`,
      description: String(desc).slice(0, 200),
      image,
      canonicalUrl,
      ogType: isRecipe ? "article" : "website",
      jsonLd,
    };
  }

  // 2. /@<username>/<permlink>
  const postMatch = norm.match(/^\/@([^/]+)\/([^/]+)/);
  if (postMatch?.[1] && postMatch?.[2]) {
    const author = decodeURIComponent(postMatch[1]);
    const permlink = decodeURIComponent(postMatch[2]);
    const post = await callMcp("get_post", { author, permlink, currency: "USD" });
    if (!post) return null;
    const title = post.title || `${permlink} by @${author}`;
    const desc = post.excerpt || `Read ${title} by @${author} on HiveCooking.com.`;
    const image = post.thumbnailUrl || post.videoThumbnailUrl || post.authorProfile?.avatarUrl || DEFAULT_IMAGE;
    return {
      title: `${title} — @${author} | HiveCooking.com`,
      description: String(desc).slice(0, 200),
      image,
      canonicalUrl,
      ogType: "article",
      jsonLd: null,
    };
  }

  // 3. /@<username>
  const userMatch = norm.match(/^\/@([^/]+)$/);
  if (userMatch?.[1]) {
    const account = decodeURIComponent(userMatch[1]);
    const prof = await callMcp("get_user_profile", { account });
    const displayName = prof?.displayName || `@${account}`;
    const desc = prof?.bio || `Explore recipes and culinary posts by ${displayName} (@${account}) on HiveCooking.com.`;
    const image = prof?.avatarUrl || DEFAULT_IMAGE;
    return {
      title: `${displayName} (@${account}) | HiveCooking.com`,
      description: String(desc).slice(0, 200),
      image,
      canonicalUrl,
      ogType: "profile",
      jsonLd: null,
    };
  }

  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const norm = url.pathname.replace(/\/+$/, "") || "/";

    const isDynamicSeoRoute =
      /^\/object\/[^/]+/.test(norm) || /^\/@[^/]+/.test(norm);

    if (!isDynamicSeoRoute) {
      return env.ASSETS.fetch(request);
    }

    // Fetch the root SPA HTML shell so we always return HTTP 200 OK
    const shellReq = new Request(new URL("/", url.origin), request);
    const shellResp = await env.ASSETS.fetch(shellReq);

    const seo = await resolveSeoMeta(url);
    if (!seo) {
      return new Response(shellResp.body, {
        status: 200,
        headers: shellResp.headers,
      });
    }

    const rewriter = new HTMLRewriter()
      .on("title", {
        element(el) {
          el.setInnerContent(seo.title);
        },
      })
      .on('meta[name="description"]', {
        element(el) {
          el.setAttribute("content", seo.description);
        },
      })
      .on("head", {
        element(el) {
          const tags = [
            `<link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}" />`,
            `<meta property="og:title" content="${escapeHtml(seo.title)}" />`,
            `<meta property="og:description" content="${escapeHtml(seo.description)}" />`,
            `<meta property="og:image" content="${escapeHtml(seo.image)}" />`,
            `<meta property="og:url" content="${escapeHtml(seo.canonicalUrl)}" />`,
            `<meta property="og:type" content="${escapeHtml(seo.ogType)}" />`,
            `<meta name="twitter:card" content="summary_large_image" />`,
            `<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`,
            `<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`,
            `<meta name="twitter:image" content="${escapeHtml(seo.image)}" />`,
          ];
          if (seo.jsonLd) {
            tags.push(
              `<script type="application/ld+json">${JSON.stringify(seo.jsonLd)}</script>`
            );
          }
          el.append(tags.join("\n"), { html: true });
        },
      });

    const transformed = rewriter.transform(shellResp);
    return new Response(transformed.body, {
      status: 200,
      headers: shellResp.headers,
    });
  },
};
