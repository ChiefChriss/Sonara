@echo off
cd /d "%~dp0"
echo Listening on all interfaces so phones and other PCs can reach the API.
echo Open: http://YOUR_LAN_IP:8000/  (same machine IP you use for Vite)
python manage.py runserver 0.0.0.0:8000
