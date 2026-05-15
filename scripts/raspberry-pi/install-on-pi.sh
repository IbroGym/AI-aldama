#!/bin/bash
# Run on Raspberry Pi (not Windows). From repo: bash scripts/raspberry-pi/install-on-pi.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="/opt/kiosk-motion"

sudo apt-get update
sudo apt-get install -y python3-gpiozero

sudo mkdir -p "$DEST"
sudo cp "$SCRIPT_DIR/motion_kiosk_wake.py" "$SCRIPT_DIR/motion_gpio_test.py" "$DEST/"
sudo chmod +x "$DEST"/*.py

sudo cp "$SCRIPT_DIR/motion-kiosk-wake.service" /etc/systemd/system/motion-kiosk-wake.service

if [[ ! -f /etc/kiosk-motion.env ]]; then
  echo "Create /etc/kiosk-motion.env from kiosk-motion.env.example (chmod 600)."
  sudo cp "$SCRIPT_DIR/kiosk-motion.env.example" /etc/kiosk-motion.env.example
fi

echo "Done. Next:"
echo "  1) sudo nano /etc/kiosk-motion.env"
echo "  2) python3 $DEST/motion_gpio_test.py   # wiring test"
echo "  3) sudo systemctl enable --now motion-kiosk-wake.service"
