#!/bin/sh
# Fake all accounts migrations through the merge point (tables already exist in prod DB)
python manage.py migrate accounts 0013_merge_0007_project_publication_0012_follow --fake 2>/dev/null
python manage.py migrate
gunicorn sonara_backend.wsgi:application --bind 0.0.0.0:${PORT}
