#!/usr/bin/env python3
"""Quick wiring test: wave hand -> prints MOTION. No Supabase needed."""

import sys

try:
    from gpiozero import MotionSensor
except ImportError:
    print("sudo apt install -y python3-gpiozero", file=sys.stderr)
    sys.exit(1)

PIN = 17  # BCM; physical pin 11
sensor = MotionSensor(PIN)
sensor.when_motion = lambda: print("MOTION detected", flush=True)
print(f"HC-SR501 test on GPIO{PIN} (physical pin 11). Wave hand. Ctrl+C to stop.")
from signal import pause

pause()
