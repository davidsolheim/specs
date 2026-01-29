# specs - Website Analysis CLI

A command-line tool for developers to quickly analyze any website's tech stack, hosting, performance, and more.

## Installation

```bash
npm install -g @sitespecs/specs
```

## Usage

```bash
# Analyze a website
specs example.com

# Analyze with full details
specs example.com --verbose

# JSON output
specs example.com --json

# Check specific aspects
specs example.com --tech
specs example.com --seo
specs example.com --performance
```

## Features

- 🔍 **Technology Detection** - Identify frameworks, libraries, CMS, hosting
- 🚀 **Performance Metrics** - Load time, page size, Core Web Vitals
- 📊 **SEO Analysis** - Meta tags, structured data, indexability
- 🌐 **Hosting Info** - Server, CDN, SSL certificate details
- ⏱️ **Uptime Status** - Current availability and response time
- 📅 **Online Since** - Domain age and registration info

## Output Example

```
$ specs example.com

🌐 example.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Technology Stack
  Framework:    Next.js 16.1.6
  Hosting:      Vercel
  Database:     Neon Postgres
  Analytics:    Google Analytics 4

⚡ Performance
  Load Time:    1.2s
  Page Size:    245 KB
  Requests:     12
  LCP:          1.1s (Good)

🔍 SEO
  Title:        Example Domain
  Description:  ✓ Present
  Open Graph:   ✓ Complete
  SSL:          ✓ Valid (expires in 89 days)

🌍 Hosting
  Server:       Vercel Edge Network
  IP:           76.76.21.21
  Location:     United States
  CDN:          Vercel Edge
  Online Since: 2020-03-15 (4 years)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## API

The CLI connects to the sitespecs.com API to fetch real-time analysis data.

## Development

```bash
# Clone the repository
git clone https://github.com/davidsolheim/specs.git
cd specs

# Install dependencies
bun install

# Run in development
bun run dev example.com

# Build
bun run build

# Test
bun test
```

## License

MIT © David Solheim

## Related

- [sitespecs.com](https://sitespecs.com) - Full-featured website monitoring and SEO platform
