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

# Débloque les comptes/IP bannis par django-axes après des tentatives échouées.
# Sans danger de le relancer à chaque déploiement.
python manage.py axes_reset || true
