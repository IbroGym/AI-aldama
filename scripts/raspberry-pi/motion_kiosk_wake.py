#!/usr/bin/env python3
"""
HC-SR501 -> Supabase kiosk_events -> browser KioskShell wakes.

Env (e.g. /etc/kiosk-motion.env, chmod 600):
  SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=...   # only on device; never commit
  KIOSK_ID=demo                   # must match NEXT_PUBLIC_KIOSK_ID in the kiosk browser
  MOTION_GPIO_PIN=17              # BCM numbering; default 17
  COOLDOWN_SEC=3                  # min seconds between POSTs
  MOTION_DEBUG=0                  # set 1 to log triggers to stderr

Requires on Raspberry Pi: python3-gpiozero (apt) or pip gpiozero.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request


def post_motion_event() -> None:
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    kiosk_id = os.environ.get("KIOSK_ID", "demo")
    event_type = os.environ.get("EVENT_TYPE", "motion")

    if not base or not key:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.", file=sys.stderr)
        sys.exit(1)

    url = f"{base}/rest/v1/kiosk_events"
    body = json.dumps({"kiosk_id": kiosk_id, "type": event_type}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        if resp.status not in (200, 201, 204):
            raise RuntimeError(f"Unexpected status {resp.status}")


def main() -> None:
    try:
        from gpiozero import MotionSensor
    except ImportError:
        print("Install gpiozero: sudo apt install python3-gpiozero", file=sys.stderr)
        sys.exit(1)

    pin = int(os.environ.get("MOTION_GPIO_PIN", "17"))
    cooldown = float(os.environ.get("COOLDOWN_SEC", "3"))
    debug = os.environ.get("MOTION_DEBUG", "0") == "1"

    last_sent = 0.0
    sensor = MotionSensor(pin)

    def on_motion() -> None:
        nonlocal last_sent
        now = time.monotonic()
        if now - last_sent < cooldown:
            return
        last_sent = now
        if debug:
            print("motion", flush=True)
        try:
            post_motion_event()
        except urllib.error.HTTPError as e:
            print(f"HTTPError {e.code}: {e.read()!r}", file=sys.stderr)
        except urllib.error.URLError as e:
            print(f"URLError: {e}", file=sys.stderr)
        except Exception as e:
            print(f"post failed: {e}", file=sys.stderr)

    sensor.when_motion = on_motion
    print(f"kiosk_motion listening BCM {pin} kiosk_id={os.environ.get('KIOSK_ID', 'demo')}", flush=True)

    from signal import pause

    pause()


if __name__ == "__main__":
    main()
