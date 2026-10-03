# GIAAIL

Website of the Architectural Informatics Lab (建築資訊學研究室), Graduate Institute of Architecture, National Yang Ming Chiao Tung University. English and Traditional Chinese, built with [Astro](https://astro.build) and published on GitHub Pages.

```
npm install
npm run dev      # http://localhost:4321/en/
npm run build    # → dist/
```

Every push to `main` builds and publishes the site (`.github/workflows/deploy.yml`).

This repository is an export. Publications, people, theses and activities are maintained in the lab's working folder (`ail-website`: source workbooks, ingest scripts, figure review) and copied here with `npm run export` there. Edit content there, export, then commit and push from here.
