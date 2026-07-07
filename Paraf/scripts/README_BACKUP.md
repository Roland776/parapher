# Sauvegarde automatique — Parapher

## Ce que fait le script

- Crée un dump SQL compressé (`.zip`) dans `Paraf/backups/`
- Copie le backup dans votre dossier Google Drive synchronisé
- Supprime automatiquement les backups de plus de 30 jours

---

## Étape 1 — Tester le script manuellement

Ouvrez PowerShell dans le dossier `Paraf/` et lancez :

```powershell
python scripts/backup_db.py
```

Résultat attendu :
```
[2026-06-18 09:00:00] ════════════════════════════
[2026-06-18 09:00:00] Sauvegarde Parapher — base : parapheur_db
[2026-06-18 09:00:00] Lancement pg_dump → backup_parapheur_db_20260618_090000.sql
[2026-06-18 09:00:01] ✅ Dump SQL créé (245 Ko)
[2026-06-18 09:00:01] ✅ Archive créée : backup_parapheur_db_20260618_090000.zip (38 Ko)
[2026-06-18 09:00:01] ☁️  Copié vers Google Drive : C:\Users\...\backup_...zip
[2026-06-18 09:00:01] ✅ Sauvegarde terminée avec succès
```

Si pg_dump est introuvable, vérifiez son chemin :
```powershell
where pg_dump
# ex : C:\Program Files\PostgreSQL\16\bin\pg_dump.exe
# Puis mettre à jour PG_DUMP_PATH dans le .env
```

---

## Étape 2 — Configurer Google Drive

1. Installer **Google Drive Desktop** : https://www.google.com/drive/download/
2. Se connecter et laisser la synchronisation démarrer
3. Créer un dossier `Backups\Parapher` dans votre Drive
4. Copier le chemin local de ce dossier (ex: `C:\Users\Roland\Google Drive\Mon Drive\Backups\Parapher`)
5. Mettre ce chemin dans `.env` :
   ```
   GDRIVE_BACKUP_FOLDER=C:\Users\Roland\Google Drive\Mon Drive\Backups\Parapher
   ```

---

## Étape 3 — Planifier l'exécution automatique (chaque nuit à 02h00)

### 3a — Créer le fichier .bat lanceur

Créez `Paraf/scripts/run_backup.bat` avec ce contenu
(adapter les chemins à votre installation) :

```bat
@echo off
cd /d "D:\WILDAF-AO\Parapher\Paraf"
"C:\Users\VotreNom\AppData\Local\Programs\Python\Python311\python.exe" scripts/backup_db.py >> logs\backup.log 2>&1
```

### 3b — Ouvrir le Planificateur de tâches Windows

1. Appuyer sur `Win + R` → taper `taskschd.msc` → Entrée
2. Dans le panneau de droite : **"Créer une tâche de base..."**

### 3c — Configurer la tâche

| Onglet | Paramètre | Valeur |
|--------|-----------|--------|
| Général | Nom | `Parapher - Backup PostgreSQL` |
| Général | Exécuter | `Qu'un utilisateur soit connecté ou non` |
| Général | Cocher | `Exécuter avec les privilèges les plus élevés` |
| Déclencheurs | Nouveau | Quotidien à **02:00** |
| Actions | Programme | Chemin vers `run_backup.bat` |
| Conditions | Décocher | `Démarrer la tâche uniquement si l'ordinateur est sur secteur` |
| Paramètres | Cocher | `Si la tâche échoue, redémarrer toutes les : 1 heure` |

### 3d — Tester la tâche

Dans le Planificateur de tâches, clic droit sur la tâche → **"Exécuter"**.
Vérifier dans `Paraf/logs/backup.log` que la sauvegarde s'est bien passée.

---

## Structure des fichiers générés

```
Paraf/
├── backups/
│   ├── backup_parapheur_db_20260618_020000.zip  ← backup local
│   ├── backup_parapheur_db_20260617_020000.zip
│   └── ...  (30 jours conservés)
└── logs/
    └── backup.log  ← historique des exécutions
```
