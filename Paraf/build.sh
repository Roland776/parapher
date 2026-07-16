#!/usr/bin/env bash
# Script de build Render — exécuté automatiquement à chaque déploiement.
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate

# Crée le superuser à partir des variables d'environnement DJANGO_SUPERUSER_*
# (fonctionnalité native de Django, pas besoin du Shell Render payant).
# Si le compte existe déjà, la commande échoue simplement — on l'ignore avec "|| true".
python manage.py createsuperuser --noinput || true

# Le champ personnalisé "role" (ADMIN / MEMBRE) n'est PAS géré par
# createsuperuser (qui ne connaît que is_staff/is_superuser). On force donc
# explicitement role=ADMIN pour ce compte. Sans danger de le relancer à
# chaque déploiement.
python manage.py shell -c "
import os
from django.contrib.auth import get_user_model
User = get_user_model()
username = os.environ.get('DJANGO_SUPERUSER_USERNAME')
if username:
    updated = User.objects.filter(username=username).update(
        role='ADMIN', is_staff=True, is_superuser=True, is_active=True
    )
    print(f'Role ADMIN applique a {username} : {updated} ligne(s) mise(s) a jour')
" || true

# Débloque les comptes/IP bannis par django-axes après des tentatives échouées.
# Sans danger de le relancer à chaque déploiement.
python manage.py axes_reset || true
