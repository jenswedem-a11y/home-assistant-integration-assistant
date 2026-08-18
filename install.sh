#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/jenswedem-a11y/home-assistant-integration-assistant.git"
INSTALL_DIR="${SMARTGUIDE_INSTALL_DIR:-$HOME/smartguide}"
PORT="${SMARTGUIDE_PORT:-8095}"

echo "SmartGuide Installer"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker wurde nicht gefunden."
  echo "Bitte zuerst Docker installieren: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Das Docker-Compose-Plugin wurde nicht gefunden."
  echo "Bitte Docker mit Compose-Plugin installieren (in aktuellen Docker-Versionen bereits enthalten)."
  exit 1
fi

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Bestehende Installation in $INSTALL_DIR gefunden, aktualisiere..."
  git -C "$INSTALL_DIR" pull --ff-only
else
  echo "Lade SmartGuide nach $INSTALL_DIR..."
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

echo
echo "Starte SmartGuide (Erststart laedt automatisch eine Datenbank mit ueber 4.000 bekannten Geraeten)..."
docker compose up -d --build

echo
echo "Fertig!"
echo "Oeffne http://localhost:${PORT} im Browser und verbinde deine Home-Assistant-Instanz."
echo "(Home-Assistant-URL und Zugriffstoken werden direkt im Browser eingerichtet, keine Konfigurationsdatei noetig.)"
