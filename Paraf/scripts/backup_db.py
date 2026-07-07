"""
backup_db.py — Sauvegarde automatique de la base PostgreSQL
Stocke le backup localement ET sur Google Drive.

Usage manuel :
    python scripts/backup_db.py

Planifié via le Planificateur de tâches Windows (voir README_BACKUP.md)
"""
import os
import sys
import subprocess
import datetime
import shutil
import zipfile
from pathlib import Path
from dotenv import load_dotenv

# Charger les variables depuis Paraf/.env
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

# ── Configuration ─────────────────────────────────────────────────────────────
DB_NAME     = os.environ['DB_NAME']
DB_USER     = os.environ['DB_USER']
DB_PASSWORD = os.environ['DB_PASSWORD']
DB_HOST     = os.environ.get('DB_HOST', 'localhost')
DB_PORT     = os.environ.get('DB_PORT', '5432')

# Dossier de sauvegarde local (créé automatiquement s'il n'existe pas)
BACKUP_DIR  = BASE_DIR / 'backups'

# Nombre de jours à conserver localement (les plus anciens sont supprimés)
RETENTION_DAYS = 30

# Google Drive — dossier de destination (laisser vide pour désactiver)
GDRIVE_FOLDER = os.environ.get('GDRIVE_BACKUP_FOLDER', '')

# Chemin vers pg_dump (adapter si PostgreSQL est installé ailleurs)
PG_DUMP = os.environ.get(
    'PG_DUMP_PATH',
    r'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe',
)
# ─────────────────────────────────────────────────────────────────────────────


def log(msg):
    ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{ts}] {msg}")


def create_backup():
    """Lance pg_dump et retourne le chemin du fichier .sql.zip créé."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    timestamp   = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    sql_file    = BACKUP_DIR / f"backup_{DB_NAME}_{timestamp}.sql"
    zip_file    = BACKUP_DIR / f"backup_{DB_NAME}_{timestamp}.zip"

    # Variables d'environnement pour pg_dump (évite le mot de passe en clair)
    env = os.environ.copy()
    env['PGPASSWORD'] = DB_PASSWORD

    log(f"Lancement pg_dump → {sql_file.name}")

    result = subprocess.run(
        [
            PG_DUMP,
            '--host', DB_HOST,
            '--port', DB_PORT,
            '--username', DB_USER,
            '--format', 'plain',   # SQL lisible
            '--no-password',
            '--file', str(sql_file),
            DB_NAME,
        ],
        env=env,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        log(f"❌ pg_dump échoué : {result.stderr}")
        sys.exit(1)

    log(f"✅ Dump SQL créé ({sql_file.stat().st_size // 1024} Ko)")

    # Compresser le .sql en .zip
    with zipfile.ZipFile(zip_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(sql_file, sql_file.name)
    sql_file.unlink()  # supprimer le .sql non compressé

    size_kb = zip_file.stat().st_size // 1024
    log(f"✅ Archive créée : {zip_file.name} ({size_kb} Ko)")
    return zip_file


def cleanup_old_backups():
    """Supprime les backups locaux de plus de RETENTION_DAYS jours."""
    cutoff = datetime.datetime.now() - datetime.timedelta(days=RETENTION_DAYS)
    deleted = 0
    for f in BACKUP_DIR.glob("backup_*.zip"):
        if datetime.datetime.fromtimestamp(f.stat().st_mtime) < cutoff:
            f.unlink()
            deleted += 1
    if deleted:
        log(f"🗑️  {deleted} ancien(s) backup(s) supprimé(s) (>{RETENTION_DAYS} jours)")


def upload_to_gdrive(zip_file: Path):
    """
    Copie le backup vers le dossier Google Drive synchronisé.
    Nécessite que Google Drive Desktop soit installé et synchronisé.
    Le dossier GDRIVE_BACKUP_FOLDER doit être un chemin local vers Drive.

    Exemple : C:\\Users\\VotreNom\\Google Drive\\Backups\\Parapher
    """
    if not GDRIVE_FOLDER:
        log("ℹ️  GDRIVE_BACKUP_FOLDER non défini — upload Google Drive ignoré")
        return

    gdrive_path = Path(GDRIVE_FOLDER)
    if not gdrive_path.exists():
        log(f"⚠️  Dossier Google Drive introuvable : {gdrive_path}")
        log("    Vérifiez que Google Drive Desktop est installé et synchronisé.")
        return

    dest = gdrive_path / zip_file.name
    shutil.copy2(zip_file, dest)
    log(f"☁️  Copié vers Google Drive : {dest}")

    # Garder uniquement les 30 derniers sur Drive aussi
    all_backups = sorted(gdrive_path.glob("backup_*.zip"), key=lambda f: f.stat().st_mtime)
    for old in all_backups[:-30]:
        old.unlink()
        log(f"🗑️  Ancien backup Drive supprimé : {old.name}")


def main():
    log("═" * 60)
    log(f"Sauvegarde Parapher — base : {DB_NAME}")
    log("═" * 60)

    # 1. Créer le backup
    zip_file = create_backup()

    # 2. Nettoyer les anciens backups locaux
    cleanup_old_backups()

    # 3. Copier sur Google Drive
    upload_to_gdrive(zip_file)

    log("═" * 60)
    log("✅ Sauvegarde terminée avec succès")
    log("═" * 60)


if __name__ == '__main__':
    main()
