# Budget tool (localStorage)

Petit outil de budget 100 % local (localStorage) pour savoir, à chaque virement client, combien envoyer sur chaque compte.

- Virement saisi en montant TTC ou en jours facturés × TJM
- Lignes mensuelles, trimestrielles ou annuelles (provisionnées /3 ou /12), avec mois et jour d'échéance
- Formules sur `{income}` (virement TTC), ex. TVA : `-Math.ceil({income} - ({income} / 1.20))`
- Plan de virements, avec « ce qui reste » vers un compte perso et alerte quand il manque de l'argent
- Pause d'une ligne pour le mois en cours, ou jusqu'à un mois donné (ex. PER suspendu jusqu'en mars)
- Mode salaire fixe : montant constant vers le compte perso, surplus vers l'épargne de précaution, complément pris dedans les mois creux
- Réserve (sous-compte charges) : solde actuel, couverture de la prochaine échéance
- Projection sur les prochains virements (jours prévus, reste cumulé, réserve)
- Import/export JSON (feuille de partage iOS pour enregistrer dans Fichiers / iCloud Drive). Les anciens exports restent importables.

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

Repo attendu : `fcordillot/budget-tool`

Ce projet est configuré pour GitHub Pages (Vite `base: /budget-tool/`) et contient un workflow GitHub Actions :

- `.github/workflows/deploy-pages.yml`

Étapes :

1. Créer le repo **public** `budget-tool` sur GitHub.
2. Pusher ce dossier.
3. Dans GitHub → **Settings → Pages** → Source: **GitHub Actions**.

URL finale : https://fcordillot.github.io/budget-tool/
