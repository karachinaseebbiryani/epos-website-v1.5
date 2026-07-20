import { useEffect } from "react";

/**
 * Shared per-page SEO hook. Sets a unique <title>, meta description, canonical
 * URL and Open Graph / Twitter tags for the page that mounts it, then restores
 * the static index.html defaults on unmount.
 *
 * WHY this exists: this is a client-side-rendered CRA app, so every route is
 * served the SAME index.html shell. Without this hook, /menu, /offers, /events
 * all inherit the homepage title, description AND canonical — which tells Google
 * every page is a duplicate of the homepage (a real ranking bug). Each public
 * page calls useSeo(...) with its own copy so Google sees distinct, indexable
 * pages with correct self-referencing canonicals.
 *
 * No dependency (react-helmet etc.) on purpose — matches the existing
 * document.head pattern already used by AboutPage / FAQPage.
 */

const SITE = "https://www.karachinaseebbiryani.com";

// Upsert a tag matched by `selector`. Creates it (with the attrs in `create`)
// if missing, marks anything we create with data-seo so we could audit it, and
// returns { el, prev } so the caller can restore the previous value on cleanup.
function upsert(selector, attr, value, create) {
  let el = document.head.querySelector(selector);
  let created = false;
  if (!el) {
    el = document.createElement(create.tag);
    Object.entries(create.attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.setAttribute("data-seo", "1");
    document.head.appendChild(el);
    created = true;
  }
  const prev = el.getAttribute(attr);
  el.setAttribute(attr, value);
  return { el, attr, prev, created };
}

/**
 * @param {object} opts
 * @param {string} opts.title        full <title> text
 * @param {string} opts.description  meta description (~150-160 chars ideal)
 * @param {string} [opts.path]       route path, e.g. "/menu" — builds canonical + og:url
 * @param {string} [opts.image]      absolute OG image URL (defaults to og-image.jpg)
 */
export function useSeo({ title, description, path = "/", image } = {}) {
  useEffect(() => {
    const canonical = SITE + (path === "/" ? "/" : path.replace(/\/+$/, ""));
    const ogImage = image || `${SITE}/og-image.jpg`;

    const prevTitle = document.title;
    if (title) document.title = title;

    const restores = [];
    if (description) {
      restores.push(
        upsert('meta[name="description"]', "content", description, {
          tag: "meta",
          attrs: { name: "description" },
        }),
        upsert('meta[property="og:description"]', "content", description, {
          tag: "meta",
          attrs: { property: "og:description" },
        }),
        upsert('meta[name="twitter:description"]', "content", description, {
          tag: "meta",
          attrs: { name: "twitter:description" },
        })
      );
    }
    if (title) {
      restores.push(
        upsert('meta[property="og:title"]', "content", title, {
          tag: "meta",
          attrs: { property: "og:title" },
        }),
        upsert('meta[name="twitter:title"]', "content", title, {
          tag: "meta",
          attrs: { name: "twitter:title" },
        })
      );
    }
    restores.push(
      upsert('link[rel="canonical"]', "href", canonical, {
        tag: "link",
        attrs: { rel: "canonical" },
      }),
      upsert('meta[property="og:url"]', "content", canonical, {
        tag: "meta",
        attrs: { property: "og:url" },
      }),
      upsert('meta[property="og:image"]', "content", ogImage, {
        tag: "meta",
        attrs: { property: "og:image" },
      }),
      upsert('meta[name="twitter:image"]', "content", ogImage, {
        tag: "meta",
        attrs: { name: "twitter:image" },
      })
    );

    return () => {
      document.title = prevTitle;
      // Restore each tag to its prior value; remove the ones we created so we
      // never leave a stale page's canonical/OG behind for the next route.
      restores.forEach(({ el, attr, prev, created }) => {
        if (created) el.remove();
        else if (prev !== null) el.setAttribute(attr, prev);
      });
    };
  }, [title, description, path, image]);
}

const DAY_NAMES = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};

/**
 * Sync the static Restaurant JSON-LD's openingHoursSpecification with the
 * admin-managed weekly schedule (the SAME data that gates online ordering and
 * feeds llms.txt — single source of truth for business hours).
 *
 * index.html ships a static fallback copy of the hours (for non-JS crawlers);
 * this rewrites it in place as soon as /public/business-hours loads, so
 * Googlebot (which renders JS) always indexes the live hours. Called from
 * ClosedBanner because that component already polls the endpoint on every
 * public page — no extra network request.
 *
 * Grouping: days sharing identical open/close collapse into one
 * OpeningHoursSpecification with a dayOfWeek array (schema.org idiom); closed
 * days are simply omitted.
 */
export function syncOpeningHoursSchema(weeklySchedule) {
  try {
    if (!weeklySchedule || typeof weeklySchedule !== "object") return;
    // Build spec groups from the live schedule.
    const groups = new Map(); // "open|close" -> [DayName, ...]
    for (const [key, name] of Object.entries(DAY_NAMES)) {
      const d = weeklySchedule[key];
      if (!d || d.closed || !d.open || !d.close) continue;
      const k = `${d.open}|${d.close}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(name);
    }
    if (groups.size === 0) return; // fully closed / malformed — keep static fallback
    const spec = [...groups.entries()].map(([k, days]) => {
      const [opens, closes] = k.split("|");
      return { "@type": "OpeningHoursSpecification", dayOfWeek: days, opens, closes };
    });

    // Locate the static Restaurant block (the one carrying an address — the
    // runtime AggregateRating block deliberately has no hours/address).
    for (const tag of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try { data = JSON.parse(tag.textContent); } catch { continue; }
      if (data?.["@type"] !== "Restaurant" || !data.address) continue;
      const next = JSON.stringify({ ...data, openingHoursSpecification: spec });
      if (tag.textContent !== next) tag.textContent = next; // idempotent
      return;
    }
  } catch { /* schema patching must never break the page */ }
}

export default useSeo;
