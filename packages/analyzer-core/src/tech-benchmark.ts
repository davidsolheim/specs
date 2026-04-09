export interface TechBenchmarkCase {
  domain: string;
  forbiddenTech: string[];
  notes?: string;
  optionalTech: string[];
  repoUrl: string;
  requiredTech: string[];
  truthSource: string[];
  unstable?: boolean;
}

export const TECH_BENCHMARK_CASES: TechBenchmarkCase[] = [
  {
    domain: "nextjs.org",
    repoUrl: "https://github.com/vercel/next.js",
    truthSource: [
      "https://github.com/vercel/next.js/blob/canary/apps/docs/package.json",
    ],
    requiredTech: ["Next.js", "Vercel"],
    optionalTech: ["React", "Tailwind CSS"],
    forbiddenTech: [],
    notes: "Docs app in the main Next.js monorepo.",
  },
  {
    domain: "react.dev",
    repoUrl: "https://github.com/reactjs/react.dev",
    truthSource: [
      "https://github.com/reactjs/react.dev/blob/main/package.json",
    ],
    requiredTech: ["Next.js", "Vercel"],
    optionalTech: ["React", "Tailwind CSS"],
    forbiddenTech: [],
    notes: "Implementation truth is the dedicated react.dev site repo, not the React project brand.",
  },
  {
    domain: "vuejs.org",
    repoUrl: "https://github.com/vuejs/docs",
    truthSource: [
      "https://github.com/vuejs/docs/blob/main/package.json",
    ],
    requiredTech: ["VitePress", "Vue.js", "Netlify"],
    optionalTech: [],
    forbiddenTech: [],
  },
  {
    domain: "vite.dev",
    repoUrl: "https://github.com/vitejs/vite",
    truthSource: [
      "https://github.com/vitejs/vite/blob/main/docs/package.json",
    ],
    requiredTech: ["VitePress", "Vue.js", "Netlify"],
    optionalTech: [],
    forbiddenTech: [],
    notes: "Truth source lives in the docs workspace inside the Vite monorepo.",
  },
  {
    domain: "svelte.dev",
    repoUrl: "https://github.com/sveltejs/svelte.dev",
    truthSource: [
      "https://github.com/sveltejs/svelte.dev/blob/main/apps/svelte.dev/package.json",
    ],
    requiredTech: ["SvelteKit", "Svelte", "Vercel"],
    optionalTech: [],
    forbiddenTech: [],
  },
  {
    domain: "astro.build",
    repoUrl: "https://github.com/withastro/astro.build",
    truthSource: [
      "https://github.com/withastro/astro.build/blob/main/package.json",
    ],
    requiredTech: ["Astro", "Netlify"],
    optionalTech: ["Tailwind CSS"],
    forbiddenTech: [],
  },
  {
    domain: "nuxt.com",
    repoUrl: "https://github.com/nuxt/nuxt.com",
    truthSource: [
      "https://github.com/nuxt/nuxt.com/blob/main/package.json",
    ],
    requiredTech: ["Nuxt", "Vue.js", "Vercel"],
    optionalTech: ["Tailwind CSS"],
    forbiddenTech: [],
  },
  {
    domain: "angular.dev",
    repoUrl: "https://github.com/angular/angular",
    truthSource: [
      "https://github.com/angular/angular/blob/main/adev/package.json",
    ],
    requiredTech: ["Angular"],
    optionalTech: [],
    forbiddenTech: [],
    notes: "Truth source is the docs app inside the Angular monorepo.",
  },
  {
    domain: "docusaurus.io",
    repoUrl: "https://github.com/facebook/docusaurus",
    truthSource: [
      "https://github.com/facebook/docusaurus/blob/main/website/package.json",
    ],
    requiredTech: ["Docusaurus"],
    optionalTech: ["React", "Cloudflare", "Netlify"],
    forbiddenTech: [],
  },
  {
    domain: "kubernetes.io",
    repoUrl: "https://github.com/kubernetes/website",
    truthSource: [
      "https://github.com/kubernetes/website/blob/main/package.json",
      "https://github.com/kubernetes/website/blob/main/hugo.toml",
    ],
    requiredTech: ["Docsy", "Hugo"],
    optionalTech: ["jQuery"],
    forbiddenTech: [],
  },
  {
    domain: "getbootstrap.com",
    repoUrl: "https://github.com/twbs/bootstrap",
    truthSource: [
      "https://github.com/twbs/bootstrap/blob/main/package.json",
      "https://github.com/twbs/bootstrap/blob/main/site/astro.config.ts",
    ],
    requiredTech: ["Astro", "Bootstrap", "Cloudflare"],
    optionalTech: ["Fastly"],
    forbiddenTech: [],
    notes: "The docs site is the Astro-powered `site` workspace in the main Bootstrap repo.",
  },
  {
    domain: "posthog.com",
    repoUrl: "https://github.com/PostHog/posthog.com",
    truthSource: [
      "https://github.com/PostHog/posthog.com/blob/master/package.json",
    ],
    requiredTech: ["Gatsby", "Tailwind CSS", "PostHog"],
    optionalTech: ["React", "Vercel"],
    forbiddenTech: [],
  },
  {
    domain: "supabase.com",
    repoUrl: "https://github.com/supabase/supabase",
    truthSource: [
      "https://github.com/supabase/supabase/blob/master/apps/www/package.json",
      "https://github.com/supabase/supabase/blob/master/apps/www/tailwind.config.js",
    ],
    requiredTech: ["Next.js", "Tailwind CSS", "Vercel"],
    optionalTech: ["React"],
    forbiddenTech: ["Bootstrap"],
    notes: "The marketing site lives in the `apps/www` workspace inside the main Supabase monorepo.",
  },
  {
    domain: "payloadcms.com",
    repoUrl: "https://github.com/payloadcms/website",
    truthSource: [
      "https://github.com/payloadcms/website/blob/main/package.json",
      "https://github.com/payloadcms/website/blob/main/src/payload.config.ts",
    ],
    requiredTech: ["Next.js", "Vercel"],
    optionalTech: ["Google Analytics", "Google Tag Manager", "Tailwind CSS"],
    forbiddenTech: [],
    notes:
      "The repo proves the site runs on Payload + Next.js, but the public homepage is intermittently fronted by a Vercel security checkpoint, so this case stays non-gating.",
    unstable: true,
  },
  {
    domain: "strapi.io",
    repoUrl: "https://github.com/strapi/website",
    truthSource: [
      "https://github.com/strapi/website/blob/main/package.json",
      "https://github.com/strapi/website/blob/main/apps/ui/package.json",
      "https://github.com/strapi/website/blob/main/apps/ui/next.config.mjs",
      "https://github.com/strapi/website/blob/main/apps/ui/postcss.config.js",
    ],
    requiredTech: ["Next.js", "Amazon CloudFront"],
    optionalTech: ["AWS", "Google Analytics", "Tailwind CSS"],
    forbiddenTech: ["Vue.js", "Svelte"],
    notes:
      "The public `apps/ui` frontend is Next.js; the monorepo also contains a Strapi app, and Tailwind appears in repo config even though the homepage does not expose stable enough signals to make it a required live detection.",
  },
  {
    domain: "directus.io",
    repoUrl: "https://github.com/directus/website",
    truthSource: [
      "https://github.com/directus/website/blob/main/package.json",
      "https://github.com/directus/website/blob/main/nuxt.config.ts",
      "https://github.com/directus/website/blob/main/app/app.vue",
    ],
    requiredTech: ["Nuxt", "Netlify"],
    optionalTech: ["PostHog", "Google Analytics", "Google Tag Manager"],
    forbiddenTech: ["Tailwind CSS"],
    notes: "The public site is a Nuxt/Vue app; generic layout class names should not be mistaken for Tailwind utilities.",
  },
];
