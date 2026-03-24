#!/bin/sh
python manage.py migrate accounts 0007_project_publication --fake 2>/dev/null
python manage.py migrate
gunicorn sonara_backend.wsgi:application --bind 0.0.0.0:${PORT}
