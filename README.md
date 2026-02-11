# Portfolio & Blog

## Quick Start

```bash
npm run dev      # Start dev server at http://localhost:4321
npm run build    # Build for production (outputs to dist/)
npm run preview  # Preview production build locally
```

## Adding a New Blog Post / Writeup

1. Create a new `.md` file in `src/content/blog/`:

```bash
touch src/content/blog/my-new-writeup.md
```

2. Add frontmatter at the top of the file:

```markdown
---
title: "Your Post Title"
description: "A short summary that shows on the blog list page"
date: "2026-02-11"
tags: ["Reverse Engineering", "CTF"]
readTime: "5 min read"
---

Your content starts here...
```

### Frontmatter Fields

| Field         | Required | Description                                      |
|---------------|----------|--------------------------------------------------|
| `title`       | Yes      | Post title                                       |
| `description` | Yes      | Short summary (shown on blog cards)              |
| `date`        | Yes      | Publish date in `YYYY-MM-DD` format              |
| `tags`        | No       | Array of tags (used for filtering on /blog page) |
| `readTime`    | No       | Estimated read time (defaults to "5 min read")   |
| `draft`       | No       | Set to `true` to hide from the blog              |

### Writing Content

Posts use standard Markdown. You can use:

- **Headers** (`## H2`, `### H3`, etc.)
- **Code blocks** with syntax highlighting (use triple backticks + language name)
- **Images** — put them in `public/images/` and reference as `/images/your-image.png`
- **Bold**, *italic*, [links](https://example.com), `inline code`
- Tables, blockquotes, lists — all standard Markdown

Code block example:
````
```python
from pwn import *
p = process('./binary')
```
````

### File Naming

Use lowercase kebab-case for filenames. The filename becomes the URL slug:

```
src/content/blog/my-cool-writeup.md  →  /blog/my-cool-writeup
src/content/blog/ideh-ctf-2026.md    →  /blog/ideh-ctf-2026
```

## Project Structure

```
src/
├── content/
│   └── blog/           ← Your writeups go here (.md files)
├── components/          ← Reusable UI components
├── layouts/             ← Page templates (base, blog post)
├── pages/               ← Site pages
│   ├── index.astro      ← Homepage
│   ├── about.astro      ← About page
│   ├── blog/            ← Blog listing + dynamic post pages
│   ├── projects.astro   ← Projects page
│   ├── ctf.astro        ← CTF achievements
│   └── contact.astro    ← Contact page
└── styles/
    └── global.css       ← Global styles & CSS variables
public/
├── favicon.svg          ← Site favicon
└── resume.pdf           ← Your resume (replace with real file)
```

## Editing Pages

- **About page** — edit `src/pages/about.astro`
- **Projects** — edit `src/pages/projects.astro` (add/remove `ProjectCard` components)
- **CTF achievements** — edit `src/pages/ctf.astro`
- **Contact links** — edit `src/pages/contact.astro`

## Adding a New Project

In `src/pages/projects.astro`, add a new `ProjectCard`:

```astro
<ProjectCard
  title="Project Name"
  description="What it does"
  tags={['Python', 'RE']}
  github="https://github.com/Jst3r/repo-name"
/>
```

## Resume

Replace the placeholder `public/resume.pdf` with your actual resume file. The download button on the homepage and about page links to `/resume.pdf`.

## Deploying

All options below are **free** for personal sites.

### Option 1: Vercel (easiest, recommended)

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/jster/jster.github.io.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click **"Add New Project"** → import your repo
4. It auto-detects Astro — just click **Deploy**
5. You get a free URL like `blog-jst3r.vercel.app`
6. (Optional) Add a custom domain in Vercel dashboard → Settings → Domains

**Auto-deploys:** Every time you `git push`, Vercel rebuilds and deploys automatically.

### Option 2: Netlify

1. Push your code to GitHub (same steps as above)
2. Go to [netlify.com](https://netlify.com) and sign in with GitHub
3. Click **"Add new site"** → **"Import an existing project"** → select your repo
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click **Deploy**
6. You get a free URL like `jst3r-blog.netlify.app`

### Option 3: GitHub Pages (free with GitHub)

1. Push your code to GitHub
2. Install the GitHub Pages adapter:
   ```bash
   npm install @astrojs/node
   ```
3. Create `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [main]

   permissions:
     contents: read
     pages: write
     id-token: write

   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
         - run: npm install
         - run: npm run build
         - uses: actions/upload-pages-artifact@v3
           with:
             path: dist
     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - uses: actions/deploy-pages@v4
           id: deployment
   ```
4. Push, and it deploys to `https://jster.github.io/`

### Option 4: Cloudflare Pages

1. Push to GitHub
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Pages → Create a project
3. Connect your GitHub repo
4. Build settings: command `npm run build`, output `dist`
5. Deploy — free URL like `blog.pages.dev`

### Custom Domain

After deploying on any platform:
1. Buy a domain (Namecheap, Cloudflare, Porkbun — all cheap)
2. Update `site` in `astro.config.mjs` to your domain
3. Add the domain in your hosting dashboard
4. Point your DNS records as instructed by the platform

### Updating Your Site After Deploy

```bash
# Make your changes (edit files, add writeups, etc.)
git add .
git commit -m "new writeup: my-post-title"
git push
# That's it — auto-deploys in ~30 seconds
```

## Customization

- **Colors** — edit CSS variables at the top of `src/styles/global.css`
- **Fonts** — change the Google Fonts import in `src/layouts/BaseLayout.astro`
- **Nav links** — edit the `navLinks` array in `src/components/Header.astro`
- **Footer socials** — edit `src/components/Footer.astro`
- **Site URL** — update `site` in `astro.config.mjs` before deploying
