/**
 * Social-crawler pre-render (React-19-safe alternative to react-snap).
 *
 * WHY: this is a client-side-rendered CRA app on React 19. Social crawlers
 * (WhatsApp, Facebook, Twitter/X, LinkedIn, Slack, Discord, Telegram, Pinterest,
 * Reddit) do NOT run JavaScript, so when someone shares a DEEP link like
 * /menu or /delivery they see the homepage's Open Graph tags instead of that
 * page's. This function returns a tiny static HTML document with the correct
 * per-route <title> / description / Open Graph / Twitter tags so the link
 * preview is right.
 *
 * IMPORTANT: only SOCIAL crawlers should be routed here (see vercel.json). Real
 * users and Googlebot must keep getting the normal SPA — Googlebot renders JS
 * fine and needs the full app, not this meta-only shell.
 *
 * Deployed automatically by Vercel as /api/prerender (functions live in /api).
 */

const SITE = "https://www.karachinaseebbiryani.com";
const OG_IMAGE = `${SITE}/og-image.jpg`;

// Route -> meta. Keep in sync with the useSeo(...) calls in the React pages.
const META = {
  "/": {
    title: "Karachi Naseeb Biryani & Murg Pulao — Order Online in Lahore",
    description:
      "Order authentic Karachi-style biryani, Murg Pulao, BBQ and karahi online in Lahore. Free delivery, live order tracking and Cash on Delivery.",
  },
  "/menu": {
    title: "Order Biryani, Pulao & BBQ Online in Lahore | Karachi Naseeb Menu",
    description:
      "Browse the full Karachi Naseeb menu — Karachi-style biryani, Murg Pulao, BBQ, karahi and more. Order online in Lahore with free delivery.",
  },
  "/offers": {
    title: "Deals & Discounts on Biryani in Lahore | Karachi Naseeb",
    description:
      "Today's deals on Karachi Naseeb biryani, pulao, BBQ and family deals in Lahore. Coupon codes, combos and Diamond rewards — order online.",
  },
  "/events": {
    title: "Biryani Catering for Weddings & Events in Lahore | Karachi Naseeb",
    description:
      "Book Karachi Naseeb for weddings, mehndi, aqeeqa, birthdays and corporate catering in Lahore. Authentic biryani, pulao and BBQ for large events.",
  },
  "/delivery": {
    title: "Delivery Areas & Info — Biryani Delivery in Lahore | Karachi Naseeb",
    description:
      "Where we deliver in Lahore, delivery timings, fees and how it works. Order authentic Karachi Naseeb biryani with free delivery and Cash on Delivery.",
  },
  "/faq": {
    title: "FAQ — Karachi Naseeb Biryani & Murg Pulao, Lahore",
    description:
      "Answers to common questions about ordering, delivery areas, timings, payment and rewards at Karachi Naseeb Biryani in Lahore.",
  },
  "/about": {
    title: "About — Karachi Naseeb Biryani & Murg Pulao",
    description:
      "Family-owned Karachi Naseeb has served authentic Karachi-style biryani, Murg Pulao and BBQ in Lahore for over 15 years.",
  },
  "/contact": {
    title: "Contact — Karachi Naseeb Biryani, Lahore",
    description:
      "Call, WhatsApp or visit Karachi Naseeb Biryani in Lahore. Get in touch for orders, catering and feedback.",
  },
};

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function handler(req, res) {
  // The original path is passed by the vercel.json rewrite as ?path=/menu.
  let path = (req.query && req.query.path) || "/";
  if (Array.isArray(path)) path = path[0] || "/";
  // Normalise: strip query/hash and any trailing slash (except root).
  path = String(path).split("?")[0].split("#")[0];
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (!path.startsWith("/")) path = "/" + path;

  const meta = META[path] || META["/"];
  const canonical = SITE + (path === "/" ? "/" : path);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="restaurant" />
<meta property="og:site_name" content="Karachi Naseeb Biryani" />
<meta property="og:title" content="${esc(meta.title)}" />
<meta property="og:description" content="${esc(meta.description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(meta.title)}" />
<meta name="twitter:description" content="${esc(meta.description)}" />
<meta name="twitter:image" content="${OG_IMAGE}" />
</head>
<body>
<h1>${esc(meta.title)}</h1>
<p>${esc(meta.description)}</p>
<p><a href="${esc(canonical)}">Open Karachi Naseeb Biryani</a></p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cache at the edge so repeat crawls are instant.
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  res.status(200).send(html);
}
