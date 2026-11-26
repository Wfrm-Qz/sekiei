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

Cloudflare Pages と GitHub Actions の build 環境で Node.js のバージョンを揃えるため、
repo root の `.node-version` で Node.js を固定します。

現在の指定:

```text
22.23.5
```

Node.js 22 系のセキュリティ修正版を指定しています。
更新時は [Node.js のセキュリティ情報](https://nodejs.org/en/blog/vulnerability) を確認し、
`.node-version` とこの文書を同時に更新します。

Cloudflare Pages に `NODE_VERSION` を設定している場合は、この指定と一致することを確認してください。
デプロイ時の build log でも、実際に使用された Node.js のバージョンを確認します。
