# Déployer Parapher gratuitement — Render + Neon + Cloudinary + Vercel

Ce guide t'emmène du zip jusqu'à une application en ligne, 100% gratuite,
sans carte bancaire.

**Limite à connaître** : le backend Render gratuit se met en veille après
15 min d'inactivité (30-60s de réveil au premier accès après une pause).
Pour un projet perso/démo, c'est très bien. Si tu veux zéro coupure plus
tard, le plan payant Render démarre à 7$/mois — mais rien à changer dans
le code, juste un changement de plan.

---

## Étape 0 — Mettre le projet sur GitHub

1. Crée un compte sur [github.com](https://github.com) si tu n'en as pas.
2. Crée un nouveau dépôt **privé** (ex: `parapher`).
3. Dans le dossier `Parapher/` (celui qui contient `Paraf/` et `frontend/`) :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/TON-USER/parapher.git
   git push -u origin main
   ```
   ⚠️ Vérifie que `git status` ne montre AUCUN fichier `.env` avant de push
   (le `.gitignore` fourni l'exclut normalement).

---

## Étape 1 — Créer la base de données (Neon, gratuit et permanent)

1. Va sur [neon.tech](https://neon.tech) → **Sign up** (avec GitHub, le plus rapide).
2. Crée un nouveau projet → nomme-le `parapher`.
3. Une fois créé, va dans **Connection Details** et copie la **Connection
   string** (commence par `postgresql://...`). Garde-la de côté, tu en
   auras besoin à l'étape 3.

---

## Étape 2 — Créer le stockage de fichiers (Cloudinary, gratuit)

Nécessaire pour que les PDF uploadés survivent aux redéploiements.

1. Va sur [cloudinary.com](https://cloudinary.com) → **Sign up for free**.
2. Sur le Dashboard, copie la valeur **API Environment variable** :
   ```
   CLOUDINARY_URL=cloudinary://123456789012345:AbCdEfGhIjKlMnOpQrStUvWxYz@ton-cloud-name
   ```
   Garde cette ligne complète de côté pour l'étape 3.

---

## Étape 3 — Déployer le backend Django sur Render

1. Va sur [render.com](https://render.com) → **Sign up** (avec GitHub).
2. **New +** → **Blueprint** → sélectionne ton dépôt `parapher`.
   Render va lire le fichier `render.yaml` fourni et proposer de créer
   `parapher-backend` (web service) et `parapher-frontend` (site statique).
3. Avant de valider, Render te demandera de remplir les variables marquées
   `sync: false`. Renseigne au minimum, pour **parapher-backend** :
   - `DATABASE_URL` → colle la connection string Neon de l'étape 1
     (ajoute `?sslmode=require` à la fin si elle n'y est pas déjà)
   - `CLOUDINARY_URL` → colle la valeur de l'étape 2
   - `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` → tes identifiants Gmail
     (mot de passe d'application, pas ton vrai mot de passe :
     https://myaccount.google.com/apppasswords)
   - `CORS_EXTRA_ORIGINS` et `FRONTEND_URL` → laisse vide pour l'instant,
     tu les rempliras à l'étape 4 une fois l'URL du frontend connue.
4. Clique **Apply**. Render construit et déploie (5-10 min la première fois).
5. Une fois en ligne, note l'URL du backend, ex :
   `https://parapher-backend.onrender.com`

---

## Étape 4 — Connecter le frontend au backend

1. Toujours sur Render, ouvre le service **parapher-frontend** →
   **Environment** → renseigne :
   ```
   REACT_APP_API_URL=https://parapher-backend.onrender.com/api/
   ```
   → **Save** (ça redéclenche un build).
2. Note l'URL du frontend une fois déployée, ex :
   `https://parapher-frontend.onrender.com`
3. Retourne sur **parapher-backend** → **Environment** → mets à jour :
   ```
   CORS_EXTRA_ORIGINS=https://parapher-frontend.onrender.com
   FRONTEND_URL=https://parapher-frontend.onrender.com
   ```
   → **Save Changes** (redéploiement automatique).

---

## Étape 5 — Créer un compte admin

Dans le dashboard Render, ouvre **parapher-backend** → onglet **Shell** :
```bash
python manage.py createsuperuser
```

---

## Étape 6 — Tester

Ouvre l'URL du frontend dans ton navigateur. Le premier chargement peut
prendre 30-60s si le backend était en veille — c'est normal.

---

## Alternative frontend : Vercel (recommandé si tu veux zéro mise en veille)

Le site statique Render est déjà sans veille, mais Vercel est souvent plus
rapide en pratique :

1. [vercel.com](https://vercel.com) → **Sign up** avec GitHub.
2. **Add New** → **Project** → sélectionne ton dépôt, **Root Directory** =
   `frontend`.
3. Ajoute la variable d'environnement `REACT_APP_API_URL` (même valeur
   qu'à l'étape 4) → **Deploy**.
4. N'oublie pas de reporter l'URL Vercel dans `CORS_EXTRA_ORIGINS` côté
   Render backend (étape 4.3).

---

## En résumé — coûts

| Service | Usage | Coût |
|---|---|---|
| Render (backend) | 750h/mois gratuites, veille après 15 min | 0€ |
| Render (frontend) ou Vercel | Illimité, pas de veille | 0€ |
| Neon (PostgreSQL) | 0.5 Go gratuit, permanent | 0€ |
| Cloudinary (fichiers) | 25 Go gratuits | 0€ |

**Total : 0€/mois**, avec la seule contrainte de la mise en veille du
backend après inactivité.
