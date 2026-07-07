"""
secure_logs.py — Sécurise les permissions du dossier logs/.
À exécuter une seule fois après déploiement.

Windows  : python secure_logs.py
Linux    : sudo -u www-data python secure_logs.py
           (ou l'utilisateur qui fait tourner Django)
"""
import os
import sys
import stat
import platform
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
LOGS_DIR = BASE_DIR / 'logs'
LOG_FILE = LOGS_DIR / 'django.log'


def secure_windows():
    """
    Sur Windows, les permissions Unix (chmod) n'ont pas d'effet.
    On utilise icacls pour restreindre l'accès au dossier logs/.
    """
    import subprocess

    # Récupérer l'utilisateur courant (celui qui fait tourner Django)
    current_user = os.environ.get('USERNAME', os.environ.get('USER', ''))
    if not current_user:
        print("❌ Impossible de détecter l'utilisateur courant.")
        sys.exit(1)

    logs_path = str(LOGS_DIR)

    print(f"🔒 Sécurisation de {logs_path} pour l'utilisateur : {current_user}")
    print()

    try:
        # 1. Retirer tous les accès hérités
        subprocess.run(
            ['icacls', logs_path, '/inheritance:r'],
            check=True, capture_output=True
        )
        print("✅ Héritage de permissions supprimé")

        # 2. Retirer tous les accès existants
        subprocess.run(
            ['icacls', logs_path, '/remove', 'Everyone'],
            check=True, capture_output=True
        )
        subprocess.run(
            ['icacls', logs_path, '/remove', 'Users'],
            capture_output=True  # pas check=True : peut ne pas exister
        )
        print("✅ Accès publics supprimés")

        # 3. Donner accès complet uniquement à l'utilisateur Django + SYSTEM
        subprocess.run(
            ['icacls', logs_path, '/grant', f'{current_user}:(OI)(CI)F'],
            check=True, capture_output=True
        )
        subprocess.run(
            ['icacls', logs_path, '/grant', 'SYSTEM:(OI)(CI)F'],
            check=True, capture_output=True
        )
        print(f"✅ Accès accordé à : {current_user} et SYSTEM uniquement")

        # 4. Afficher le résultat pour vérification
        result = subprocess.run(
            ['icacls', logs_path],
            capture_output=True, text=True
        )
        print()
        print("=== Permissions actuelles ===")
        print(result.stdout)

    except subprocess.CalledProcessError as e:
        print(f"❌ Erreur icacls : {e}")
        print("   Relancez en tant qu'administrateur (clic droit → Exécuter en tant qu'administrateur)")
        sys.exit(1)
    except FileNotFoundError:
        print("❌ icacls introuvable. Êtes-vous bien sur Windows ?")
        sys.exit(1)


def secure_linux():
    """
    Sur Linux/Mac : chmod 700 sur le dossier, 600 sur le fichier.
    Doit être lancé par le propriétaire du process Django (ex: www-data).
    """
    import pwd, grp

    current_uid  = os.getuid()
    current_user = pwd.getpwuid(current_uid).pw_name

    dir_owner_uid  = os.stat(LOGS_DIR).st_uid
    dir_owner_name = pwd.getpwuid(dir_owner_uid).pw_name

    print(f"👤 Utilisateur courant     : {current_user} (uid={current_uid})")
    print(f"📁 Propriétaire de logs/   : {dir_owner_name} (uid={dir_owner_uid})")
    print()

    # Si on est root, changer le propriétaire vers l'utilisateur Django
    if current_uid == 0:
        django_user = input(
            "Vous êtes root. Quel utilisateur fait tourner Django ? "
            "(ex: www-data, ubuntu, deploy) : "
        ).strip()
        if not django_user:
            print("❌ Nom d'utilisateur requis.")
            sys.exit(1)
        try:
            pw = pwd.getpwnam(django_user)
        except KeyError:
            print(f"❌ Utilisateur '{django_user}' introuvable.")
            sys.exit(1)
        target_uid = pw.pw_uid
        target_gid = pw.pw_gid
        os.chown(LOGS_DIR, target_uid, target_gid)
        os.chown(LOG_FILE, target_uid, target_gid)
        print(f"✅ Propriétaire changé vers : {django_user}")
    elif current_uid != dir_owner_uid:
        print(f"⚠️  Vous n'êtes pas propriétaire du dossier logs/.")
        print(f"   Relancez avec : sudo -u {dir_owner_name} python secure_logs.py")
        print(f"   Ou en tant que root pour changer le propriétaire.")
        sys.exit(1)

    # Appliquer les permissions
    os.chmod(LOGS_DIR, stat.S_IRWXU)               # 700 : rwx------
    os.chmod(LOG_FILE, stat.S_IRUSR | stat.S_IWUSR) # 600 : rw-------

    dir_mode  = oct(os.stat(LOGS_DIR).st_mode)[-3:]
    file_mode = oct(os.stat(LOG_FILE).st_mode)[-3:]

    print(f"✅ logs/       → mode {dir_mode}  (rwx------)")
    print(f"✅ django.log  → mode {file_mode}  (rw-------)")

    if dir_mode == '700' and file_mode == '600':
        print()
        print("✅ Logs sécurisés — seul le process Django peut lire les logs.")
    else:
        print()
        print("❌ Les permissions ne correspondent pas — vérifiez manuellement.")
        sys.exit(1)


def main():
    print(f"Système détecté : {platform.system()}")
    print()

    # Créer logs/ et django.log s'ils n'existent pas
    LOGS_DIR.mkdir(exist_ok=True)
    LOG_FILE.touch(exist_ok=True)

    if platform.system() == 'Windows':
        secure_windows()
    else:
        secure_linux()


if __name__ == '__main__':
    main()
