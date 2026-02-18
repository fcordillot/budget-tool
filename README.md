# Buget tool (localStorage)

Petit outil de budget 100% local (localStorage) avec import/export JSON, formules `{income}`, récap par tag/compte et plan de transferts.

## Dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Déploiement GitHub Pages

Repo attendu : `fcordillot/buget-tool`

Ce projet est configuré pour GitHub Pages (Vite `base: /buget-tool/`) et contient un workflow GitHub Actions :

- `.github/workflows/deploy-pages.yml`

Étapes :
1) Créer le repo **public** `buget-tool` sur GitHub.
2) Pusher ce dossier.
3) Dans GitHub → **Settings → Pages** → Source: **GitHub Actions**.

URL finale : https://fcordillot.github.io/buget-tool/
