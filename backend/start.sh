#!/bin/sh
# Fake the duplicate branch migrations that already exist in the DB
python manage.py migrate accounts 0007_alter_track_audio_file_alter_track_id_and_more --fake 2>/dev/null
python manage.py migrate accounts 0007_project_publication --fake 2>/dev/null
python manage.py migrate accounts 0008_user_display_name --fake 2>/dev/null
python manage.py migrate accounts 0009_like --fake 2>/dev/null
python manage.py migrate accounts 0010_track_metadata --fake 2>/dev/null
python manage.py migrate accounts 0011_track_cover_image --fake 2>/dev/null
python manage.py migrate
gunicorn sonara_backend.wsgi:application --bind 0.0.0.0:${PORT}
