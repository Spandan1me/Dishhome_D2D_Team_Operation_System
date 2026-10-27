import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() == 'true'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured('DJANGO_SECRET_KEY must be configured when DJANGO_DEBUG is false.')
    SECRET_KEY = 'django-insecure-local-development-only'

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get(
        'ALLOWED_HOSTS',
        'localhost,127.0.0.1,0.0.0.0' if DEBUG else '',
    ).split(',')
    if host.strip()
]
render_hostname = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if render_hostname:
    ALLOWED_HOSTS.append(render_hostname)
if not DEBUG and (not ALLOWED_HOSTS or '*' in ALLOWED_HOSTS):
    raise ImproperlyConfigured('Set explicit production hostnames in ALLOWED_HOSTS.')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'drf_spectacular',

    # Local apps
    'apps.accounts.apps.AccountsConfig',
    'apps.customers.apps.CustomersConfig',
    'apps.imports.apps.ImportsConfig',
    'apps.allocations.apps.AllocationsConfig',
    'apps.visits.apps.VisitsConfig',
    'apps.followups.apps.FollowupsConfig',
    'apps.reports.apps.ReportsConfig',
    'apps.audit.apps.AuditConfig',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
if not DEBUG:
    MIDDLEWARE.insert(2, 'whitenoise.middleware.WhiteNoiseMiddleware')

ROOT_URLCONF = 'd2d_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'd2d_project.wsgi.application'

# Database
database_url = os.environ.get('DATABASE_URL')
if not DEBUG and not database_url:
    raise ImproperlyConfigured('DATABASE_URL must be configured for production.')
if database_url:
    import dj_database_url

    DATABASES = {
        'default': dj_database_url.parse(
            database_url,
            conn_max_age=600,
            ssl_require=not DEBUG,
        )
    }
elif os.environ.get('POSTGRES_DB'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'dishhome_d2d'),
            'USER': os.environ.get('POSTGRES_USER', 'postgres'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'postgres'),
            'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 6},
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kathmandu'
USE_I18N = True
USE_TZ = True

# Static and Media files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DATA_UPLOAD_MAX_MEMORY_SIZE = 60 * 1024 * 1024
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

supabase_storage_settings = {
    'bucket_name': os.environ.get('SUPABASE_STORAGE_BUCKET'),
    'access_key': os.environ.get('SUPABASE_S3_ACCESS_KEY_ID'),
    'secret_key': os.environ.get('SUPABASE_S3_SECRET_ACCESS_KEY'),
    'endpoint_url': os.environ.get('SUPABASE_S3_ENDPOINT'),
    'region_name': os.environ.get('SUPABASE_S3_REGION'),
}
configured_supabase_storage = all(supabase_storage_settings.values())
if any(supabase_storage_settings.values()) and not configured_supabase_storage:
    raise ImproperlyConfigured(
        'Configure SUPABASE_STORAGE_BUCKET, SUPABASE_S3_ACCESS_KEY_ID, '
        'SUPABASE_S3_SECRET_ACCESS_KEY, SUPABASE_S3_ENDPOINT, and SUPABASE_S3_REGION together.'
    )
if not DEBUG and not configured_supabase_storage:
    raise ImproperlyConfigured(
        'Supabase Storage must be configured in production so uploaded visit evidence is durable.'
    )

if configured_supabase_storage:
    STORAGES['default'] = {
        'BACKEND': 'storages.backends.s3.S3Storage',
        'OPTIONS': {
            **supabase_storage_settings,
            'addressing_style': 'path',
            'signature_version': 's3v4',
            'default_acl': None,
            'querystring_auth': True,
            'file_overwrite': False,
        },
    }

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DATETIME_FORMAT': '%Y-%m-%d %H:%M:%S',
    'DATE_FORMAT': '%Y-%m-%d',
}

# Swagger / OpenAPI Settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'DishHome D2D Field Operations API',
    'DESCRIPTION': 'RESTful API for DishHome Internet Door-to-Door (D2D) customer visits, team allocations, and reporting.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    origin.strip().rstrip('/')
    for origin in os.environ.get(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:80' if DEBUG else '',
    ).split(',')
    if origin.strip()
]
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
if not DEBUG and not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured('Set CORS_ALLOWED_ORIGINS to the Vercel site origin.')

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000
