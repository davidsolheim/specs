/**
 * Native Technology Detection Rules
 * Pattern-based detection for 100+ web technologies
 */

export enum TechCategory {
  JAVASCRIPT_FRAMEWORK = 'JavaScript Framework',
  CSS_FRAMEWORK = 'CSS Framework',
  UI_LIBRARY = 'UI Library',
  WEB_SERVER = 'Web Server',
  PROGRAMMING_LANGUAGE = 'Programming Language',
  WEB_FRAMEWORK = 'Web Framework',
  CMS = 'CMS',
  ECOMMERCE = 'Ecommerce',
  HOSTING = 'Hosting',
  CDN = 'CDN',
  PAAS = 'PaaS',
  ANALYTICS = 'Analytics',
  TAG_MANAGER = 'Tag Manager',
  ADVERTISING = 'Advertising',
  PAYMENT_PROCESSOR = 'Payment Processor',
  FONT_LIBRARY = 'Font Library',
  VIDEO_PLAYER = 'Video Player',
  LIVE_CHAT = 'Live Chat',
  MAP_SERVICE = 'Map Service',
  JAVASCRIPT_LIBRARY = 'JavaScript Library',
}

export interface TechRule {
  name: string;
  category: TechCategory;
  website?: string;
  description?: string;
  icon?: string;
  
  patterns: {
    html?: RegExp[];
    headers?: Record<string, RegExp>;
    scripts?: string[];
    meta?: Record<string, RegExp>;
    cookies?: string[];
    dom?: string[];
    globals?: string[];
  };
  
  version?: {
    pattern: RegExp;
    group: number;
  };
  
  weight?: number;
}

export const TECH_RULES: TechRule[] = [
  // ============ FRONTEND FRAMEWORKS ============
  {
    name: 'React',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://react.dev',
    description: 'JavaScript library for building user interfaces',
    patterns: {
      html: [/react/i],
      scripts: ['react', 'react-dom'],
      dom: ['data-reactroot', 'data-reactid'],
      globals: ['React', '__REACT_DEVTOOLS_GLOBAL_HOOK__'],
    },
    version: {
      pattern: /react@([0-9.]+)/i,
      group: 1,
    },
    weight: 2,
  },
  {
    name: 'Next.js',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://nextjs.org',
    description: 'React framework for production',
    patterns: {
      html: [/next\.js/i, /__next/i],
      scripts: ['/_next/static/', '/_next/'],
      meta: {
        generator: /next\.js/i,
      },
      headers: {
        'x-nextjs-cache': /.*/,
        'x-nextjs-page': /.*/,
      },
      globals: ['__NEXT_DATA__'],
    },
    version: {
      pattern: /next\.js\s+([0-9.]+)/i,
      group: 1,
    },
    weight: 3,
  },
  {
    name: 'Vue.js',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://vuejs.org',
    description: 'Progressive JavaScript framework',
    patterns: {
      scripts: [
        'vue',
        'vue.js',
        'vue.min.js',
        'plugin-vue_export-helper',
        'runtime-core.esm-bundler',
        'runtime-dom.esm-bundler',
      ],
      dom: ['v-cloak', 'v-if', 'v-for', 'data-v-'],
      globals: ['Vue', '__VUE__'],
    },
    version: {
      pattern: /vue@([0-9.]+)/i,
      group: 1,
    },
    weight: 2,
  },
  {
    name: 'Nuxt',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://nuxt.com',
    description: 'Vue framework for production',
    patterns: {
      html: [/nuxt/i, /__nuxt/i],
      scripts: ['/_nuxt/', '/nuxt/'],
      globals: ['__NUXT__'],
    },
    version: {
      pattern: /nuxt@([0-9.]+)/i,
      group: 1,
    },
    weight: 3,
  },
  {
    name: 'Angular',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://angular.io',
    description: 'Platform for building web applications',
    patterns: {
      html: [/ng-version/i],
      scripts: ['angular', '@angular/'],
      dom: ['ng-version', 'ng-app', '_ngcontent-', '_nghost-'],
      globals: ['ng', 'getAllAngularRootElements'],
    },
    version: {
      pattern: /ng-version="([0-9.]+)"/i,
      group: 1,
    },
    weight: 2,
  },
  {
    name: 'Svelte',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://svelte.dev',
    description: 'Cybernetically enhanced web apps',
    patterns: {
      html: [
        /\b__sveltekit_[a-z0-9_]+\b/i,
        /\bdata-sveltekit-preload-(?:data|code)\b/i,
        /class=["'][^"']*\bsvelte-[a-z0-9]+\b/i,
      ],
      scripts: ['svelte', 'svelte.js'],
      dom: ['data-svelte-h'],
    },
    version: {
      pattern: /svelte@([0-9.]+)/i,
      group: 1,
    },
    weight: 2,
  },
  {
    name: 'SvelteKit',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://kit.svelte.dev',
    description: 'Svelte framework for production',
    patterns: {
      html: [/sveltekit/i, /__sveltekit/i],
      scripts: ['/_app/', '__sveltekit'],
      globals: ['__sveltekit'],
    },
    weight: 3,
  },
  {
    name: 'Remix',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://remix.run',
    description: 'Full stack web framework',
    patterns: {
      html: [/remix/i],
      scripts: ['/build/', 'remix'],
      meta: {
        generator: /remix/i,
      },
    },
    weight: 3,
  },
  {
    name: 'Astro',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://astro.build',
    description: 'Web framework for content-driven websites',
    patterns: {
      html: [/astro/i],
      scripts: ['/_astro/'],
      meta: {
        generator: /astro/i,
      },
    },
    weight: 3,
  },
  {
    name: 'VitePress',
    category: TechCategory.WEB_FRAMEWORK,
    website: 'https://vitepress.dev',
    description: 'Vue-powered static site generator',
    patterns: {
      html: [
        /__VP_SITE_DATA__/i,
        /__VP_HASH_MAP__/i,
        /vitepress-theme-appearance/i,
        /class=["'][^"']*\bVP(?:App|Nav|Content)\b/i,
      ],
      scripts: ['plugin-vue_export-helper'],
      meta: {
        generator: /vitepress/i,
      },
    },
    weight: 3,
  },
  {
    name: 'Docusaurus',
    category: TechCategory.WEB_FRAMEWORK,
    website: 'https://docusaurus.io',
    description: 'Static site generator for documentation websites',
    patterns: {
      html: [/__docusaurus/i, /docusaurus_locale/i, /docusaurus_tag/i, /Built with Docusaurus/i],
      scripts: ['/assets/js/runtime~main', '/assets/js/main.'],
      meta: {
        generator: /docusaurus/i,
      },
    },
    weight: 3,
  },
  {
    name: 'Gatsby',
    category: TechCategory.WEB_FRAMEWORK,
    website: 'https://www.gatsbyjs.com',
    description: 'React framework for content-rich websites',
    patterns: {
      html: [/id=["']___gatsby/i, /gatsby-focus-wrapper/i, /data-react-helmet/i, /webpack-runtime/i],
      meta: {
        generator: /gatsby/i,
      },
    },
    weight: 3,
  },
  {
    name: 'Hugo',
    category: TechCategory.WEB_FRAMEWORK,
    website: 'https://gohugo.io',
    description: 'Static site generator written in Go',
    patterns: {
      html: [/<meta[^>]+name=["']generator["'][^>]+content=["'][^"']*hugo/i],
      headers: {
        'x-generator': /hugo/i,
      },
      meta: {
        generator: /hugo/i,
      },
    },
    weight: 3,
  },
  {
    name: 'Docsy',
    category: TechCategory.WEB_FRAMEWORK,
    website: 'https://www.docsy.dev',
    description: 'Documentation theme and site framework built on Hugo',
    patterns: {
      html: [
        /class=["'][^"']*\btd-navbar\b/i,
        /class=["'][^"']*\btd-home\b/i,
        /class=["'][^"']*\btd-(?:outer|main|box)\b/i,
      ],
    },
    weight: 3,
  },
  {
    name: 'Solid',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://solidjs.com',
    description: 'Reactive JavaScript library',
    patterns: {
      html: [/solid-js/i],
      scripts: ['solid-js', 'solidjs'],
      globals: ['Solid'],
    },
    weight: 2,
  },
  {
    name: 'Qwik',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://qwik.builder.io',
    description: 'Resumable framework',
    patterns: {
      html: [/qwik/i],
      scripts: ['/build/q-'],
      dom: ['q:'],
    },
    weight: 2,
  },
  {
    name: 'Preact',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://preactjs.com',
    description: 'Fast 3kB alternative to React',
    patterns: {
      html: [/preact/i],
      scripts: ['preact', 'preact.js'],
      globals: ['preact'],
    },
    weight: 2,
  },
  {
    name: 'Alpine.js',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://alpinejs.dev',
    description: 'Lightweight JavaScript framework',
    patterns: {
      html: [/alpine/i],
      scripts: ['alpine', 'alpinejs'],
      dom: ['x-data', 'x-show', 'x-if'],
    },
    weight: 2,
  },
  {
    name: 'Ember.js',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://emberjs.com',
    description: 'Framework for ambitious web developers',
    patterns: {
      html: [/ember/i],
      scripts: ['ember', 'ember.js'],
      globals: ['Ember'],
      meta: {
        generator: /ember/i,
      },
    },
    weight: 2,
  },
  {
    name: 'Lit',
    category: TechCategory.JAVASCRIPT_FRAMEWORK,
    website: 'https://lit.dev',
    description: 'Simple. Fast. Web Components.',
    patterns: {
      html: [/lit-element/i],
      scripts: ['lit', 'lit-element'],
    },
    weight: 2,
  },

  // ============ CSS FRAMEWORKS ============
  {
    name: 'Tailwind CSS',
    category: TechCategory.CSS_FRAMEWORK,
    website: 'https://tailwindcss.com',
    description: 'Utility-first CSS framework',
    patterns: {
      html: [
        /tailwind/i,
        /class=["'][^"']*\b(?:flex|grid)\b[^"']*\b(?:items-center|items-start|items-end|justify-between|justify-center|justify-start)\b/i,
        /class=["'][^"']*\b(?:bg-[a-z0-9-]+|text-[a-z0-9-]+)\b/i,
        /class=["'][^"']*\b(?:p-\d+|px-\d+|py-\d+|pt-\d+|pr-\d+|pb-\d+|pl-\d+|m-\d+|mx-\d+|my-\d+)\b/i,
      ],
      scripts: ['tailwind', 'tailwindcss'],
    },
    weight: 2,
  },
  {
    name: 'Bootstrap',
    category: TechCategory.CSS_FRAMEWORK,
    website: 'https://getbootstrap.com',
    description: 'Popular CSS framework',
    patterns: {
      html: [
        /bootstrap(?:\.bundle|(?:\.min)?)\.(?:css|js)\b/i,
        /\bdata-bs-(?:toggle|target|ride|dismiss)\b/i,
        /class=["'][^"']*\bbtn\b[^"']*\bbtn-[a-z0-9-]+\b/i,
        /class=["'][^"']*\bnavbar\b[^"']*\bnavbar-(?:expand|brand|toggler|nav)\b/i,
        /class=["'][^"']*\bcontainer(?:-fluid)?\b[^"']*\brow\b/i,
      ],
      scripts: ['bootstrap', 'bootstrap.min.js'],
    },
    version: {
      pattern: /bootstrap@([0-9.]+)/i,
      group: 1,
    },
    weight: 2,
  },
  {
    name: 'Material-UI',
    category: TechCategory.UI_LIBRARY,
    website: 'https://mui.com',
    description: 'React component library',
    patterns: {
      html: [/mui/i, /material-ui/i],
      scripts: ['@mui/', '@material-ui/'],
      dom: ['class*="Mui"', 'class*="makeStyles"'],
    },
    weight: 2,
  },
  {
    name: 'Ant Design',
    category: TechCategory.UI_LIBRARY,
    website: 'https://ant.design',
    description: 'Enterprise-class UI design system',
    patterns: {
      html: [/antd/i],
      scripts: ['antd', 'ant-design'],
      dom: ['class*="ant-"'],
    },
    weight: 2,
  },
  {
    name: 'Chakra UI',
    category: TechCategory.UI_LIBRARY,
    website: 'https://chakra-ui.com',
    description: 'Modular component library',
    patterns: {
      html: [/chakra/i],
      scripts: ['@chakra-ui/'],
      dom: ['class*="chakra-"'],
    },
    weight: 2,
  },
  {
    name: 'Bulma',
    category: TechCategory.CSS_FRAMEWORK,
    website: 'https://bulma.io',
    description: 'Modern CSS framework',
    patterns: {
      html: [/bulma/i],
      scripts: ['bulma'],
      dom: ['class*="column"', 'class*="section"'],
    },
    weight: 2,
  },
  {
    name: 'Foundation',
    category: TechCategory.CSS_FRAMEWORK,
    website: 'https://get.foundation',
    description: 'Responsive front-end framework',
    patterns: {
      html: [/foundation/i],
      scripts: ['foundation'],
    },
    weight: 2,
  },
  {
    name: 'Semantic UI',
    category: TechCategory.CSS_FRAMEWORK,
    website: 'https://semantic-ui.com',
    description: 'User interface framework',
    patterns: {
      html: [/semantic-ui/i],
      scripts: ['semantic', 'semantic-ui'],
      dom: ['class*="ui "'],
    },
    weight: 2,
  },

  // ============ CMS PLATFORMS ============
  {
    name: 'WordPress',
    category: TechCategory.CMS,
    website: 'https://wordpress.org',
    description: 'Open source CMS',
    patterns: {
      html: [/wp-content/i, /wp-includes/i],
      scripts: ['/wp-content/', '/wp-includes/'],
      meta: {
        generator: /wordpress/i,
      },
      headers: {
        'x-powered-by': /wordpress/i,
      },
    },
    version: {
      pattern: /wordpress\s+([0-9.]+)/i,
      group: 1,
    },
    weight: 3,
  },
  {
    name: 'Shopify',
    category: TechCategory.ECOMMERCE,
    website: 'https://shopify.com',
    description: 'Ecommerce platform',
    patterns: {
      html: [/shopify/i, /cdn\.shopify\.com/i],
      scripts: ['cdn.shopify.com', 'shopify'],
      headers: {
        'x-shopify-stage': /.*/,
        'x-shopify-shop-api-call-limit': /.*/,
      },
      cookies: ['_shopify_'],
    },
    weight: 3,
  },
  {
    name: 'Wix',
    category: TechCategory.CMS,
    website: 'https://wix.com',
    description: 'Website builder',
    patterns: {
      html: [/wix\.com/i, /wixstatic\.com/i],
      scripts: ['static.wixstatic.com', 'parastorage.com'],
      meta: {
        generator: /wix\.com/i,
      },
    },
    weight: 3,
  },
  {
    name: 'Squarespace',
    category: TechCategory.CMS,
    website: 'https://squarespace.com',
    description: 'Website builder and hosting',
    patterns: {
      html: [/squarespace/i],
      scripts: ['squarespace'],
      meta: {
        generator: /squarespace/i,
      },
      headers: {
        'x-servedby': /squarespace/i,
      },
    },
    weight: 3,
  },
  {
    name: 'Webflow',
    category: TechCategory.CMS,
    website: 'https://webflow.com',
    description: 'Visual web development platform',
    patterns: {
      html: [/webflow/i],
      scripts: ['webflow'],
      meta: {
        generator: /webflow/i,
      },
      dom: ['data-wf-page', 'data-wf-site'],
    },
    weight: 3,
  },
  {
    name: 'Drupal',
    category: TechCategory.CMS,
    website: 'https://drupal.org',
    description: 'Open source CMS',
    patterns: {
      html: [/drupal/i],
      scripts: ['/sites/default/', '/sites/all/'],
      meta: {
        generator: /drupal/i,
      },
      headers: {
        'x-drupal-cache': /.*/,
        'x-generator': /drupal/i,
      },
    },
    version: {
      pattern: /drupal\s+([0-9.]+)/i,
      group: 1,
    },
    weight: 3,
  },
  {
    name: 'Joomla',
    category: TechCategory.CMS,
    website: 'https://joomla.org',
    description: 'Open source CMS',
    patterns: {
      html: [/joomla/i],
      scripts: ['/media/jui/', '/media/system/'],
      meta: {
        generator: /joomla/i,
      },
    },
    version: {
      pattern: /joomla!\s+([0-9.]+)/i,
      group: 1,
    },
    weight: 3,
  },
  {
    name: 'Ghost',
    category: TechCategory.CMS,
    website: 'https://ghost.org',
    description: 'Professional publishing platform',
    patterns: {
      html: [/ghost/i],
      meta: {
        generator: /ghost/i,
      },
    },
    version: {
      pattern: /ghost\s+([0-9.]+)/i,
      group: 1,
    },
    weight: 3,
  },
  {
    name: 'Contentful',
    category: TechCategory.CMS,
    website: 'https://contentful.com',
    description: 'Headless CMS',
    patterns: {
      html: [/contentful/i],
      scripts: ['contentful'],
    },
    weight: 2,
  },
  {
    name: 'Strapi',
    category: TechCategory.CMS,
    website: 'https://strapi.io',
    description: 'Headless CMS',
    patterns: {
      html: [/strapi/i],
      headers: {
        'x-powered-by': /strapi/i,
      },
    },
    weight: 2,
  },

  // ============ HOSTING / PAAS ============
  {
    name: 'Vercel',
    category: TechCategory.PAAS,
    website: 'https://vercel.com',
    description: 'Platform for frontend developers',
    patterns: {
      headers: {
        'x-vercel-id': /.*/,
        'x-vercel-cache': /.*/,
        server: /vercel/i,
      },
    },
    weight: 3,
  },
  {
    name: 'Netlify',
    category: TechCategory.PAAS,
    website: 'https://netlify.com',
    description: 'Platform for web development',
    patterns: {
      headers: {
        'x-nf-request-id': /.*/,
        server: /netlify/i,
      },
    },
    weight: 3,
  },
  {
    name: 'Railway',
    category: TechCategory.PAAS,
    website: 'https://railway.app',
    description: 'Infrastructure platform',
    patterns: {
      headers: {
        'x-railway-id': /.*/,
      },
    },
    weight: 3,
  },
  {
    name: 'Render',
    category: TechCategory.PAAS,
    website: 'https://render.com',
    description: 'Cloud application platform',
    patterns: {
      headers: {
        'x-render-origin-server': /.*/,
        server: /render/i,
      },
    },
    weight: 3,
  },
  {
    name: 'Fly.io',
    category: TechCategory.PAAS,
    website: 'https://fly.io',
    description: 'Global application platform',
    patterns: {
      headers: {
        'fly-request-id': /.*/,
        server: /fly\.io/i,
      },
    },
    weight: 3,
  },
  {
    name: 'Heroku',
    category: TechCategory.PAAS,
    website: 'https://heroku.com',
    description: 'Cloud application platform',
    patterns: {
      headers: {
        'x-heroku-queue-wait-time': /.*/,
        server: /heroku/i,
      },
    },
    weight: 3,
  },
  {
    name: 'AWS',
    category: TechCategory.HOSTING,
    website: 'https://aws.amazon.com',
    description: 'Cloud computing services',
    patterns: {
      headers: {
        'x-amz-request-id': /.*/,
        'x-amz-cf-id': /.*/,
        server: /amazon/i,
      },
    },
    weight: 2,
  },
  {
    name: 'Google Cloud',
    category: TechCategory.HOSTING,
    website: 'https://cloud.google.com',
    description: 'Cloud computing services',
    patterns: {
      headers: {
        'x-goog-': /.*/,
        server: /gws|gfe/i,
      },
    },
    weight: 2,
  },
  {
    name: 'DigitalOcean',
    category: TechCategory.HOSTING,
    website: 'https://digitalocean.com',
    description: 'Cloud infrastructure',
    patterns: {
      headers: {
        server: /digitalocean/i,
      },
    },
    weight: 2,
  },

  // ============ CDN ============
  {
    name: 'Cloudflare',
    category: TechCategory.CDN,
    website: 'https://cloudflare.com',
    description: 'Web infrastructure and security',
    patterns: {
      headers: {
        'cf-ray': /.*/,
        'cf-cache-status': /.*/,
        server: /cloudflare/i,
      },
      cookies: ['__cfduid', '__cf_bm'],
    },
    weight: 3,
  },
  {
    name: 'Fastly',
    category: TechCategory.CDN,
    website: 'https://fastly.com',
    description: 'Edge cloud platform',
    patterns: {
      headers: {
        'x-fastly-request-id': /.*/,
        'fastly-': /.*/,
      },
    },
    weight: 3,
  },
  {
    name: 'Akamai',
    category: TechCategory.CDN,
    website: 'https://akamai.com',
    description: 'Content delivery network',
    patterns: {
      headers: {
        'x-akamai-': /.*/,
      },
    },
    weight: 3,
  },
  {
    name: 'Amazon CloudFront',
    category: TechCategory.CDN,
    website: 'https://aws.amazon.com/cloudfront',
    description: 'Content delivery network',
    patterns: {
      headers: {
        'x-amz-cf-id': /.*/,
        'x-amz-cf-pop': /.*/,
        'via': /cloudfront/i,
      },
    },
    weight: 3,
  },
  {
    name: 'Bunny CDN',
    category: TechCategory.CDN,
    website: 'https://bunny.net',
    description: 'Content delivery network',
    patterns: {
      headers: {
        'cdn-pullzone': /.*/,
        server: /bunnycdn/i,
      },
    },
    weight: 3,
  },

  // ============ ANALYTICS ============
  {
    name: 'Google Analytics',
    category: TechCategory.ANALYTICS,
    website: 'https://analytics.google.com',
    description: 'Web analytics service',
    patterns: {
      html: [/google-analytics\.com/i, /gtag/i, /ga\(/],
      scripts: ['google-analytics.com/analytics.js', 'googletagmanager.com/gtag/js'],
      globals: ['ga', 'gtag', '__gaTracker'],
      cookies: ['_ga', '_gid', '_gat'],
    },
    weight: 3,
  },
  {
    name: 'Google Tag Manager',
    category: TechCategory.TAG_MANAGER,
    website: 'https://tagmanager.google.com',
    description: 'Tag management system',
    patterns: {
      html: [/googletagmanager\.com/i],
      scripts: ['googletagmanager.com/gtm.js'],
      globals: ['google_tag_manager', 'dataLayer'],
    },
    weight: 3,
  },
  {
    name: 'Mixpanel',
    category: TechCategory.ANALYTICS,
    website: 'https://mixpanel.com',
    description: 'Product analytics',
    patterns: {
      html: [/mixpanel/i],
      scripts: ['mixpanel.com', 'mixpanel'],
      globals: ['mixpanel'],
    },
    weight: 3,
  },
  {
    name: 'Amplitude',
    category: TechCategory.ANALYTICS,
    website: 'https://amplitude.com',
    description: 'Product analytics',
    patterns: {
      html: [/amplitude/i],
      scripts: ['amplitude.com', 'amplitude'],
      globals: ['amplitude'],
    },
    weight: 3,
  },
  {
    name: 'Plausible',
    category: TechCategory.ANALYTICS,
    website: 'https://plausible.io',
    description: 'Privacy-friendly analytics',
    patterns: {
      html: [/plausible/i],
      scripts: ['plausible.io/js/script.js'],
    },
    weight: 3,
  },
  {
    name: 'Fathom Analytics',
    category: TechCategory.ANALYTICS,
    website: 'https://usefathom.com',
    description: 'Privacy-focused analytics',
    patterns: {
      html: [/fathom/i],
      scripts: ['cdn.usefathom.com'],
    },
    weight: 3,
  },
  {
    name: 'PostHog',
    category: TechCategory.ANALYTICS,
    website: 'https://posthog.com',
    description: 'Product analytics platform',
    patterns: {
      html: [/posthog/i],
      scripts: ['posthog'],
      globals: ['posthog'],
    },
    weight: 3,
  },
  {
    name: 'Segment',
    category: TechCategory.ANALYTICS,
    website: 'https://segment.com',
    description: 'Customer data platform',
    patterns: {
      html: [/segment/i],
      scripts: ['cdn.segment.com'],
      globals: ['analytics'],
    },
    weight: 3,
  },
  {
    name: 'Heap',
    category: TechCategory.ANALYTICS,
    website: 'https://heap.io',
    description: 'Digital insights platform',
    patterns: {
      html: [/heap/i],
      scripts: ['heapanalytics.com'],
      globals: ['heap'],
    },
    weight: 3,
  },

  // ============ PAYMENT PROCESSORS ============
  {
    name: 'Stripe',
    category: TechCategory.PAYMENT_PROCESSOR,
    website: 'https://stripe.com',
    description: 'Payment processing platform',
    patterns: {
      html: [/stripe/i],
      scripts: ['js.stripe.com'],
      globals: ['Stripe'],
    },
    weight: 3,
  },
  {
    name: 'PayPal',
    category: TechCategory.PAYMENT_PROCESSOR,
    website: 'https://paypal.com',
    description: 'Online payment system',
    patterns: {
      html: [/paypal/i],
      scripts: ['paypal.com', 'paypalobjects.com'],
      globals: ['paypal', 'PAYPAL'],
    },
    weight: 3,
  },
  {
    name: 'Square',
    category: TechCategory.PAYMENT_PROCESSOR,
    website: 'https://squareup.com',
    description: 'Payment processing',
    patterns: {
      html: [/square/i, /squareup/i],
      scripts: ['squareup.com', 'squarecdn.com'],
      globals: ['Square'],
    },
    weight: 3,
  },
  {
    name: 'Braintree',
    category: TechCategory.PAYMENT_PROCESSOR,
    website: 'https://braintreepayments.com',
    description: 'Payment platform',
    patterns: {
      html: [/braintree/i],
      scripts: ['braintreegateway.com'],
      globals: ['braintree'],
    },
    weight: 3,
  },

  // ============ JAVASCRIPT LIBRARIES ============
  {
    name: 'jQuery',
    category: TechCategory.JAVASCRIPT_LIBRARY,
    website: 'https://jquery.com',
    description: 'JavaScript library',
    patterns: {
      html: [/jquery/i],
      scripts: ['jquery', 'jquery.min.js'],
      globals: ['jQuery', '$'],
    },
    version: {
      pattern: /jquery[/-]([0-9.]+)/i,
      group: 1,
    },
    weight: 2,
  },
  {
    name: 'Lodash',
    category: TechCategory.JAVASCRIPT_LIBRARY,
    website: 'https://lodash.com',
    description: 'Utility library',
    patterns: {
      html: [/lodash/i],
      scripts: ['lodash'],
    },
    weight: 2,
  },
  {
    name: 'Axios',
    category: TechCategory.JAVASCRIPT_LIBRARY,
    website: 'https://axios-http.com',
    description: 'HTTP client',
    patterns: {
      html: [/axios/i],
      scripts: ['axios'],
      globals: ['axios'],
    },
    weight: 2,
  },
  {
    name: 'GSAP',
    category: TechCategory.JAVASCRIPT_LIBRARY,
    website: 'https://greensock.com/gsap',
    description: 'Animation library',
    patterns: {
      html: [/gsap/i, /greensock/i],
      scripts: ['gsap', 'greensock'],
      globals: ['gsap', 'TweenMax'],
    },
    weight: 2,
  },
  {
    name: 'Three.js',
    category: TechCategory.JAVASCRIPT_LIBRARY,
    website: 'https://threejs.org',
    description: '3D library',
    patterns: {
      html: [/three\.js/i],
      scripts: ['three.js', 'three.min.js'],
      globals: ['THREE'],
    },
    weight: 2,
  },
  {
    name: 'D3.js',
    category: TechCategory.JAVASCRIPT_LIBRARY,
    website: 'https://d3js.org',
    description: 'Data visualization library',
    patterns: {
      html: [/d3\.js/i],
      scripts: ['d3.js', 'd3.min.js'],
      globals: ['d3'],
    },
    version: {
      pattern: /d3@([0-9.]+)/i,
      group: 1,
    },
    weight: 2,
  },
  {
    name: 'Chart.js',
    category: TechCategory.JAVASCRIPT_LIBRARY,
    website: 'https://chartjs.org',
    description: 'Charting library',
    patterns: {
      html: [/chart\.js/i],
      scripts: ['chart.js'],
      globals: ['Chart'],
    },
    weight: 2,
  },
  {
    name: 'Socket.IO',
    category: TechCategory.JAVASCRIPT_LIBRARY,
    website: 'https://socket.io',
    description: 'Real-time communication',
    patterns: {
      html: [/socket\.io/i],
      scripts: ['socket.io'],
      globals: ['io'],
    },
    weight: 2,
  },
  {
    name: 'Swiper',
    category: TechCategory.JAVASCRIPT_LIBRARY,
    website: 'https://swiperjs.com',
    description: 'Mobile touch slider',
    patterns: {
      html: [/swiper/i],
      scripts: ['swiper'],
      dom: ['class*="swiper-"'],
    },
    weight: 2,
  },

  // ============ WEB SERVERS ============
  {
    name: 'Nginx',
    category: TechCategory.WEB_SERVER,
    website: 'https://nginx.org',
    description: 'Web server',
    patterns: {
      headers: {
        server: /nginx/i,
      },
    },
    version: {
      pattern: /nginx\/([0-9.]+)/i,
      group: 1,
    },
    weight: 3,
  },
  {
    name: 'Apache',
    category: TechCategory.WEB_SERVER,
    website: 'https://httpd.apache.org',
    description: 'Web server',
    patterns: {
      headers: {
        server: /apache/i,
      },
    },
    version: {
      pattern: /apache\/([0-9.]+)/i,
      group: 1,
    },
    weight: 3,
  },
  {
    name: 'Node.js',
    category: TechCategory.WEB_SERVER,
    website: 'https://nodejs.org',
    description: 'JavaScript runtime',
    patterns: {
      headers: {
        'x-powered-by': /express|node/i,
        server: /node/i,
      },
    },
    weight: 2,
  },
  {
    name: 'Express',
    category: TechCategory.WEB_FRAMEWORK,
    website: 'https://expressjs.com',
    description: 'Node.js web framework',
    patterns: {
      headers: {
        'x-powered-by': /express/i,
      },
    },
    weight: 2,
  },
  {
    name: 'Caddy',
    category: TechCategory.WEB_SERVER,
    website: 'https://caddyserver.com',
    description: 'Web server with automatic HTTPS',
    patterns: {
      headers: {
        server: /caddy/i,
      },
    },
    weight: 3,
  },

  // ============ OTHER ============
  {
    name: 'Google Fonts',
    category: TechCategory.FONT_LIBRARY,
    website: 'https://fonts.google.com',
    description: 'Font library',
    patterns: {
      html: [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i],
      scripts: ['fonts.googleapis.com'],
    },
    weight: 2,
  },
  {
    name: 'Font Awesome',
    category: TechCategory.FONT_LIBRARY,
    website: 'https://fontawesome.com',
    description: 'Icon library',
    patterns: {
      html: [/font-awesome/i, /fontawesome/i],
      scripts: ['fontawesome', 'font-awesome'],
      dom: ['class*="fa-"'],
    },
    weight: 2,
  },
  {
    name: 'YouTube',
    category: TechCategory.VIDEO_PLAYER,
    website: 'https://youtube.com',
    description: 'Video platform',
    patterns: {
      html: [/youtube\.com\/embed/i, /youtu\.be/i],
      scripts: ['youtube.com'],
    },
    weight: 2,
  },
  {
    name: 'Vimeo',
    category: TechCategory.VIDEO_PLAYER,
    website: 'https://vimeo.com',
    description: 'Video platform',
    patterns: {
      html: [/vimeo\.com\/video/i, /player\.vimeo\.com/i],
      scripts: ['player.vimeo.com'],
    },
    weight: 2,
  },
  {
    name: 'Intercom',
    category: TechCategory.LIVE_CHAT,
    website: 'https://intercom.com',
    description: 'Customer messaging platform',
    patterns: {
      html: [/intercom/i],
      scripts: ['widget.intercom.io'],
      globals: ['Intercom'],
    },
    weight: 3,
  },
  {
    name: 'Zendesk',
    category: TechCategory.LIVE_CHAT,
    website: 'https://zendesk.com',
    description: 'Customer service software',
    patterns: {
      html: [/zendesk/i],
      scripts: ['zendesk.com'],
      globals: ['zE'],
    },
    weight: 3,
  },
  {
    name: 'Google Maps',
    category: TechCategory.MAP_SERVICE,
    website: 'https://maps.google.com',
    description: 'Mapping service',
    patterns: {
      html: [/maps\.googleapis\.com/i, /maps\.google\.com/i],
      scripts: ['maps.googleapis.com'],
      globals: ['google.maps'],
    },
    weight: 2,
  },
  {
    name: 'Mapbox',
    category: TechCategory.MAP_SERVICE,
    website: 'https://mapbox.com',
    description: 'Mapping platform',
    patterns: {
      html: [/mapbox/i],
      scripts: ['mapbox'],
      globals: ['mapboxgl'],
    },
    weight: 2,
  },
];
