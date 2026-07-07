@echo off
REM ── Parapher — Lanceur de sauvegarde PostgreSQL ───────────────────────────
REM Adapter les deux chemins ci-dessous à votre installation

REM Chemin vers le dossier Paraf (où se trouve manage.py)
cd /d "D:\WILDAF-AO\Parapher\Paraf"

REM Chemin vers Python (vérifier avec : where python  dans PowerShell)
"C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe" scripts\backup_db.py >> logs\backup.log 2>&1

REM Code retour : 0 = succès, autre = échec
exit /b %ERRORLEVEL%
