import os
from pathlib import Path
from datetime import timedelta

# Charger les variables du fichier .env automatiquement
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv pas installé — les variables doivent être définies autrement

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Sécurité ──────────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY manquante dans le fichier .env !")

DEBUG = os.environ.get('DEBUG', 'False') == 'True'

# CORRECTION #4 : localhost ET 127.0.0.1 inclus par défaut
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Render fournit automatiquement son nom d'hôte via cette variable —
# on l'ajoute pour ne pas avoir à la dupliquer manuellement dans ALLOWED_HOSTS.
_render_hostname = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if _render_hostname:
    ALLOWED_HOSTS.append(_render_hostname)

# ── Applications ──────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    'corsheaders',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework_simplejwt.token_blacklist',
    'axes',          # anti brute force
    'utilisateur',
    'documents',
    'rest_framework',
]

AUTH_USER_MODEL = 'utilisateur.CustomUser'

AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',       # vérification lockout en premier
    'django.contrib.auth.backends.ModelBackend', # authentification normale ensuite
]

# ── Anti brute force (django-axes) ───────────────────────────────────────────
AXES_FAILURE_LIMIT       = 5          # blocage après 5 échecs consécutifs
AXES_COOLOFF_TIME        = 1          # déblocage automatique après 1 heure
AXES_RESET_ON_SUCCESS    = True       # remet le compteur à 0 après un login réussi
AXES_LOCKOUT_PARAMETERS  = ['username', 'ip_address']  # bloque le couple IP+username
AXES_ENABLE_ACCESS_FAILURE_LOG = True # journalise les tentatives échouées

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'axes.middleware.AxesMiddleware',  # doit être en dernier
]

ROOT_URLCONF = 'Paraf.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'Paraf.wsgi.application'

# ── Base de données ───────────────────────────────────────────────────────────
# En production (Render), DATABASE_URL est fournie par Neon, ex :
#   postgresql://user:password@ep-xxx.neon.tech/parapheur_db?sslmode=require
# En local (développement Windows), on garde les variables DB_* classiques.
import dj_database_url

_database_url = os.environ.get('DATABASE_URL')
if _database_url:
    DATABASES = {
        'default': dj_database_url.parse(
            _database_url,
            conn_max_age=600,
            ssl_require=True,
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME':     os.environ.get('DB_NAME',     'parapheur_db'),
            'USER':     os.environ.get('DB_USER',     'postgres'),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST':     os.environ.get('DB_HOST',     'localhost'),
            'PORT':     os.environ.get('DB_PORT',     '5432'),
        }
    }

# ── Validation mots de passe ──────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ── Langue et fuseau horaire ──────────────────────────────────────────────────
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Lome'
USE_I18N = True
USE_TZ = True

# ── Fichiers statiques et médias ─────────────────────────────────────────────
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Les documents PDF (media) doivent survivre aux redéploiements.
# Render a un disque éphémère : sans CLOUDINARY_URL, les fichiers seraient
# perdus à chaque redéploiement. Si CLOUDINARY_URL est définie (production),
# on stocke les médias sur Cloudinary (persistant). Sinon (local), stockage
# classique sur disque.
_cloudinary_url = os.environ.get('CLOUDINARY_URL')
if _cloudinary_url:
    INSTALLED_APPS = ['cloudinary_storage'] + INSTALLED_APPS + ['cloudinary']
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
    MEDIA_URL = '/media/'
else:
    MEDIA_URL = '/media/'
    MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── CORS ─────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://cogwheel-utmost-manger.ngrok-free.dev',
]

# En production, ajoutez votre domaine ici via la variable d'environnement
_extra_origins = os.environ.get('CORS_EXTRA_ORIGINS', '')
if _extra_origins:
    CORS_ALLOWED_ORIGINS += [o.strip() for o in _extra_origins.split(',') if o.strip()]

CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ['Content-Disposition', 'Content-Type']
CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization',
    'content-type', 'dnt', 'origin',
    'user-agent', 'x-csrftoken', 'x-requested-with',
    'ngrok-skip-browser-warning',  # bypass page d'avertissement ngrok (tunnel dev)
]

# ── Django REST Framework ─────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # CORRECTION #11 : pagination globale pour éviter les requêtes géantes
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}

# ── JWT ───────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ── E-mail ────────────────────────────────────────────────────────────────────
# La config email est INDÉPENDANTE de DEBUG.
# En local : mettre EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend dans .env
# En prod  : laisser vide → smtp.EmailBackend est utilisé automatiquement
#
# Avantage : passer DEBUG=False en prod ne casse pas les emails,
# et un DEBUG=True accidentel en prod n'empêche pas les emails de partir.

# ── E-mail ────────────────────────────────────────────────────────────────────
# Render (plan gratuit) bloque tout le trafic SMTP sortant (ports 25/465/587).
# Solution : si BREVO_API_KEY est définie, on envoie les emails via l'API HTTPS
# de Brevo (django-anymail) au lieu de SMTP. En local (pas de BREVO_API_KEY),
# on garde le SMTP classique comme avant.
_brevo_api_key = os.environ.get('BREVO_API_KEY')

if _brevo_api_key:
    INSTALLED_APPS = INSTALLED_APPS + ['anymail']
    EMAIL_BACKEND = 'anymail.backends.brevo.EmailBackend'
    ANYMAIL = {
        'BREVO_API_KEY': _brevo_api_key,
    }
else:
    EMAIL_BACKEND = os.environ.get(
        'EMAIL_BACKEND',
        'django.core.mail.backends.smtp.EmailBackend',
    )
    EMAIL_HOST          = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT          = int(os.environ.get('EMAIL_PORT', '587'))
    EMAIL_USE_TLS       = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
    EMAIL_HOST_USER     = os.environ.get('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')

    # Vérification au démarrage : alerter si les credentials SMTP sont absents
    _email_backend_is_smtp = (EMAIL_BACKEND == 'django.core.mail.backends.smtp.EmailBackend')
    if _email_backend_is_smtp and not EMAIL_HOST_USER:
        import warnings
        warnings.warn(
            "EMAIL_HOST_USER est vide mais EMAIL_BACKEND est smtp. "
            "Les emails ne partiront pas. Vérifiez votre .env.",
            stacklevel=2,
        )

    DEFAULT_FROM_EMAIL = (
        os.environ.get('DEFAULT_FROM_EMAIL', '')
        or os.environ.get('EMAIL_HOST_USER', '')
    )
    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

# ── Sécurité HTTPS (production uniquement) ────────────────────────────────────
if not DEBUG:
    SECURE_SSL_REDIRECT            = True
    SESSION_COOKIE_SECURE          = True
    CSRF_COOKIE_SECURE             = True
    SECURE_HSTS_SECONDS            = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_BROWSER_XSS_FILTER      = True
    SECURE_CONTENT_TYPE_NOSNIFF    = True
else:
    # Désactiver explicitement toute redirection SSL en développement.
    # Sans ces lignes, un HSTS mémorisé par le navigateur peut forcer HTTPS
    # sur localhost même quand Django tourne en HTTP → ERR_SSL_PROTOCOL_ERROR
    SECURE_SSL_REDIRECT   = False
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE    = False
    SECURE_HSTS_SECONDS   = 0

# ── Limite taille fichiers ─────────────────────────────────────────────────────
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10 Mo
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ── CORRECTION #13 : Logging en production ───────────────────────────────────

# ── Filtre de redaction des UUIDs dans les logs ───────────────────────────────
# Les logs Django loggent les URLs complètes, ex :
#   GET /api/documents/c5e3f9bb-6e2f-48cb-a2e6-d9d201ba84c1/view/ 401
# Ce filtre remplace les UUIDs par [uuid] pour ne pas exposer les IDs de documents.
import logging
import re as _re

class RedactUUIDFilter(logging.Filter):
    _UUID_RE = _re.compile(
        r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
        _re.IGNORECASE,
    )

    def filter(self, record):
        record.msg = self._UUID_RE.sub('[uuid]', str(record.msg))
        if record.args:
            if isinstance(record.args, dict):
                record.args = {
                    k: self._UUID_RE.sub('[uuid]', str(v))
                    for k, v in record.args.items()
                }
            elif isinstance(record.args, tuple):
                record.args = tuple(
                    self._UUID_RE.sub('[uuid]', str(a)) for a in record.args
                )
        return True


LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'redact_uuid': {
            '()': RedactUUIDFilter,
        },
    },
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
            'filters': ['redact_uuid'],
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        # Intercepte les logs HTTP (URLs complètes avec UUIDs)
        'django.server': {
            'handlers': ['console'],
            'level': 'WARNING',  # ne log que les erreurs, pas les 200/301
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'documents': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Sur Render, le disque est éphémère : un fichier de log n'a aucun intérêt
# (il disparaît au redéploiement) et le dossier logs/ n'existe pas dans le
# repo. Render capture déjà stdout/stderr dans son propre dashboard, donc on
# se contente du handler 'console' ci-dessus. En local (Windows), on ajoute
# le fichier de log tournant comme avant.
if not os.environ.get('RENDER'):
    _logs_dir = os.path.join(BASE_DIR, 'logs')
    os.makedirs(_logs_dir, exist_ok=True)

    LOGGING['handlers']['file'] = {
        'class': 'logging.handlers.RotatingFileHandler',
        'filename': os.path.join(_logs_dir, 'django.log'),
        'maxBytes': 5 * 1024 * 1024,  # 5 Mo max par fichier
        'backupCount': 5,
        'formatter': 'verbose',
        'filters': ['redact_uuid'],
        'encoding': 'utf-8',
    }
    for _logger_config in [LOGGING['root'], *LOGGING['loggers'].values()]:
        _logger_config['handlers'].append('file')
