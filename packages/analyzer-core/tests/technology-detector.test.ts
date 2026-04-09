import { describe, expect, test } from "bun:test";

import { TECH_BENCHMARK_CASES } from "../src/tech-benchmark";
import { detectTechnologies, getFramework, getHostingProvider } from "../src/technology-detector";

const INVENTRIGHT_LIKE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="generator" content="WordPress 6.9.4" />
    <title>inventRight | Helping Inventors For Over 25 Years</title>
    <link rel="stylesheet" href="/wp-content/themes/divi/style.css" />
    <script src="https://inventright.com/wp-includes/js/jquery/jquery.min.js?ver=3.7.1"></script>
    <script src="https://inventright.com/wp-includes/js/dist/vendor/react.min.js?ver=18.3.1.1"></script>
    <script src="https://inventright.com/wp-includes/js/dist/vendor/react-dom.min.js?ver=18.3.1.1"></script>
    <script src="https://inventright.com/wp-content/plugins/divi-torque-lite-public.js?ver=1.2.3"></script>
    <script src="https://inventright.com/wp-content/plugins/example/build/main.js?ver=1.0.0"></script>
  </head>
  <body class="et-social-dbdb-drupal et-social-dbdb-ghost et-social-dbdb-squarespace">
    <main>
      <p>September November December</p>
      <div q:slot="hero">Inventors welcome.</div>
    </main>
  </body>
</html>
`.trim();

const VITEPRESS_LIKE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="generator" content="VitePress v2.0.0-alpha.17" />
    <script type="module" src="/assets/app.DYGYmXB9.js"></script>
    <link rel="modulepreload" href="/assets/chunks/plugin-vue_export-helper.CHIaqsk5.js" />
    <script id="check-dark-mode">
      localStorage.getItem('vitepress-theme-appearance');
      window.__VP_HASH_MAP__ = {};
    </script>
  </head>
  <body>
    <div id="app">
      <div class="VPApp">
        <header class="VPNav"></header>
        <main class="VPContent" data-v-749a779f></main>
      </div>
    </div>
    <script>
      window.__VP_SITE_DATA__ = {};
    </script>
  </body>
</html>
`.trim();

const DOCUSAURUS_LIKE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="generator" content="Docusaurus v3.9.2" />
    <meta name="docusaurus_locale" content="en" />
    <meta name="docusaurus_tag" content="default" />
    <script src="/assets/js/runtime~main.e6e0b054.js" defer></script>
    <script src="/assets/js/main.02044143.js" defer></script>
  </head>
  <body>
    <div id="__docusaurus"></div>
    <footer>Built with Docusaurus.</footer>
  </body>
</html>
`.trim();

const DOCSY_HUGO_LIKE_HTML = `
<!doctype html>
<html lang="en" class="no-js">
  <head>
    <meta charset="utf-8" />
    <meta name="generator" content="Hugo 0.133.0" />
    <script src="/js/main.min.c0bae94f.js"></script>
  </head>
  <body class="td-home">
    <nav class="td-navbar"></nav>
    <div class="td-outer">
      <main class="td-main"></main>
      <section class="td-box"></section>
    </div>
  </body>
</html>
`.trim();

const GATSBY_LIKE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="generator" content="Gatsby 4.25.9" />
    <meta data-react-helmet="true" name="description" content="All your developer tools in one place." />
    <script src="/webpack-runtime-123abc.js"></script>
  </head>
  <body>
    <div id="___gatsby">
      <div id="gatsby-focus-wrapper"></div>
    </div>
  </body>
</html>
`.trim();

const GENERIC_NEXT_TAILWIND_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Generic product page</title>
    <script src="/_next/static/chunks/main.js"></script>
    <script>window.__NEXT_DATA__ = {};</script>
  </head>
  <body>
    <div class="container row">
      <main class="mx-auto flex items-center justify-between bg-slate-950 p-4 text-white">
        <button class="btn-primary rounded px-4 py-2">Start</button>
      </main>
    </div>
  </body>
</html>
`.trim();

const STRAPI_NEXT_LIKE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Strapi - Open source Node.js Headless CMS</title>
    <script src="/_next/static/chunks/main.js"></script>
    <script>window.__NEXT_DATA__ = {};</script>
  </head>
  <body>
    <main class="mx-auto flex items-center justify-between bg-violet-600 px-4 py-2 text-white">
      <a href="/integrations/vuejs-cms">Vue.js CMS</a>
      <a href="/integrations/svelte-cms">Svelte CMS</a>
    </main>
  </body>
</html>
`.trim();

const DIRECTUS_NUXT_LIKE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <script>window.__NUXT__ = {};</script>
    <script src="/_nuxt/entry.abcd1234.js"></script>
    <style>
      .theme-provider[data-v-9e813837] { color: var(--foreground); }
      .grid[data-v-2aabbd4b] { display: grid; }
    </style>
  </head>
  <body>
    <div class="grid two-one"></div>
    <div class="theme-provider light on-background page-section bg-pristine-white-lines space-medium"></div>
    <div class="base-text-container text"></div>
  </body>
</html>
`.trim();

describe("technology detector precision", () => {
  test("keeps strong WordPress and CDN signals while dropping weak substring false positives", async () => {
    const detections = await detectTechnologies({
      url: "https://inventright.com",
      html: INVENTRIGHT_LIKE_HTML,
      headers: {
        server: "cloudflare",
        "cf-ray": "12345",
        "cf-cache-status": "DYNAMIC",
      },
    });

    const names = detections.map((technology) => technology.name);

    expect(names).toContain("WordPress");
    expect(names).toContain("Cloudflare");
    expect(names).toContain("React");

    expect(names).not.toContain("Cloudflare Pages");
    expect(names).not.toContain("Drupal");
    expect(names).not.toContain("Ghost");
    expect(names).not.toContain("Squarespace");
    expect(names).not.toContain("Ember.js");
    expect(names).not.toContain("Lit");
    expect(names).not.toContain("Remix");

    expect(detections.find((technology) => technology.name === "WordPress")?.confidence).toBe("high");
    expect(detections.find((technology) => technology.name === "Cloudflare")?.confidence).toBe("high");
    expect(detections.find((technology) => technology.name === "React")?.confidence).toBe("medium");

    expect(getFramework(detections)).toBeUndefined();
    expect(getHostingProvider(detections)).toBe("Cloudflare");
  });

  test("prefers VitePress over Vue.js for docs-style Vue sites", async () => {
    const detections = await detectTechnologies({
      url: "https://vuejs.org",
      html: VITEPRESS_LIKE_HTML,
      headers: {},
    });

    const names = detections.map((technology) => technology.name);

    expect(names).toContain("VitePress");
    expect(names).toContain("Vue.js");
    expect(getFramework(detections)).toBe("VitePress");
  });

  test("detects Docusaurus as the primary framework instead of falling back to React-only summaries", async () => {
    const detections = await detectTechnologies({
      url: "https://docusaurus.io",
      html: DOCUSAURUS_LIKE_HTML,
      headers: {},
    });

    const names = detections.map((technology) => technology.name);

    expect(names).toContain("Docusaurus");
    expect(getFramework(detections)).toBe("Docusaurus");
  });

  test("prefers Docsy over Hugo when both site-generator signals are present", async () => {
    const detections = await detectTechnologies({
      url: "https://kubernetes.io",
      html: DOCSY_HUGO_LIKE_HTML,
      headers: {},
    });

    const names = detections.map((technology) => technology.name);

    expect(names).toContain("Docsy");
    expect(names).toContain("Hugo");
    expect(getFramework(detections)).toBe("Docsy");
  });

  test("detects Gatsby from docs and app-shell markers", async () => {
    const detections = await detectTechnologies({
      url: "https://posthog.com",
      html: GATSBY_LIKE_HTML,
      headers: {},
    });

    const names = detections.map((technology) => technology.name);

    expect(names).toContain("Gatsby");
    expect(getFramework(detections)).toBe("Gatsby");
  });

  test("does not mistake generic utility and layout classes for Bootstrap", async () => {
    const detections = await detectTechnologies({
      url: "https://supabase.com",
      html: GENERIC_NEXT_TAILWIND_HTML,
      headers: {},
    });

    const names = detections.map((technology) => technology.name);

    expect(names).toContain("Next.js");
    expect(names).toContain("Tailwind CSS");
    expect(names).not.toContain("Bootstrap");
    expect(getFramework(detections)).toBe("Next.js");
  });

  test("does not infer Vue.js or Svelte from integration-link content on Next.js marketing pages", async () => {
    const detections = await detectTechnologies({
      url: "https://strapi.io",
      html: STRAPI_NEXT_LIKE_HTML,
      headers: {},
    });

    const names = detections.map((technology) => technology.name);

    expect(names).toContain("Next.js");
    expect(names).toContain("Tailwind CSS");
    expect(names).not.toContain("Vue.js");
    expect(names).not.toContain("Svelte");
    expect(getFramework(detections)).toBe("Next.js");
  });

  test("does not mistake generic grid and text classes on Nuxt sites for Tailwind", async () => {
    const detections = await detectTechnologies({
      url: "https://directus.io",
      html: DIRECTUS_NUXT_LIKE_HTML,
      headers: {},
    });

    const names = detections.map((technology) => technology.name);

    expect(names).toContain("Nuxt");
    expect(names).not.toContain("Tailwind CSS");
    expect(getFramework(detections)).toBe("Nuxt");
  });
});

describe("tech benchmark manifest", () => {
  test("tracks the first- and second-wave public benchmark cohorts", () => {
    expect(TECH_BENCHMARK_CASES).toHaveLength(16);
    expect(new Set(TECH_BENCHMARK_CASES.map((benchmarkCase) => benchmarkCase.domain)).size).toBe(
      TECH_BENCHMARK_CASES.length,
    );

    for (const benchmarkCase of TECH_BENCHMARK_CASES) {
      expect(benchmarkCase.truthSource.length).toBeGreaterThan(0);
      expect(benchmarkCase.requiredTech.length).toBeGreaterThan(0);
    }
  });
});
