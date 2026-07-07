"""
Point d'entrée du serveur de production (Waitress — compatible Windows).

Lancement :
    cd Paraf
    python serve.py

WhiteNoise sert uniquement les fichiers statiques Django (admin, DRF browsable API).
Les fichiers médias (PDFs) sont servis par la vue Django serve_protected_media,
qui vérifie l'authentification avant de renvoyer le fichier.
"""
import os
import sys
from pathlib import Path

# S'assurer que le dossier courant est dans le path Python
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

# Charger les variables d'environnement depuis .env
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Paraf.settings")

from waitress import serve
from django.core.wsgi import get_wsgi_application
from whitenoise import WhiteNoise

# Obtenir l'application Django WSGI
application = get_wsgi_application()

# CORRECTION #3 : WhiteNoise sert uniquement les fichiers STATIQUES (pas les médias)
# Les médias sont protégés par la vue serve_protected_media dans urls.py
static_root = str(BASE_DIR / "staticfiles")
application = WhiteNoise(application, root=static_root, prefix="static")

if __name__ == "__main__":
    host    = os.environ.get("SERVER_HOST", "0.0.0.0")
    port    = int(os.environ.get("SERVER_PORT", "8000"))
    threads = int(os.environ.get("SERVER_THREADS", "4"))

    print(f"✅ Serveur Waitress démarré sur http://{host}:{port}")
    print(f"   Threads : {threads}")
    print(f"   Django DEBUG : {os.environ.get('DEBUG', 'False')}")
    serve(application, host=host, port=port, threads=threads)