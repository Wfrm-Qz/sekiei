# Deployment

Sekiei は Vite の静的 build を Cloudflare Pages へ配置する想定です。

Production URL: https://sekiei.pages.dev/

## Cloudflare Pages

- Framework preset: `Vite`
- Production branch: `master`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

## Node.js

Cloudflare Pages の build 環境で Node.js の差異による build ぶれを避けるため、
repo root の `.node-version` で Node.js を固定します。

現在の指定:

```text
22.16.0
```

この値は Cloudflare Pages v3 build image の Node.js 既定値に合わせています。
