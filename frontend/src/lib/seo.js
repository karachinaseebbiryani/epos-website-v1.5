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

export default useSeo;
