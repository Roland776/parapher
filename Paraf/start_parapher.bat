@echo off
echo Démarrage de Parapher...

:: Aller dans le dossier backend
cd /d "%~dp0Paraf"

:: Activer l'environnement virtuel
call ..\venv\Scripts\activate.bat

:: Lancer le serveur
python serve.py