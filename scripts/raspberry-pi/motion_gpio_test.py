#!/usr/bin/env python3
"""
Test HC-SR501 / HW-416-B wiring on Raspberry Pi.

  sudo apt install -y python3-gpiozero python3-lgpio
  sudo python3 motion_gpio_test.py

Env:
  MOTION_GPIO_PIN=17   # BCM, physical pin 11
"""

from __future__ import annotations

import os
import sys
import time

PIN = int(os.environ.get("MOTION_GPIO_PIN", "17"))
PHYSICAL_PIN = {17: 11, 27: 13, 22: 15}.get(PIN, "?")


def setup_pin_factory() -> None:
    try:
        from gpiozero import Device
        from gpiozero.pins.lgpio import LGPIOFactory

        Device.pin_factory = LGPIOFactory()
        print("Using LGPIO pin factory (Bookworm).", flush=True)
    except ImportError:
        print("python3-lgpio not installed; trying default gpiozero factory.", flush=True)


def poll_out_line(seconds: float = 120.0) -> None:
    from gpiozero import DigitalInputDevice

    inp = DigitalInputDevice(PIN, pull_up=False)
    print(
        f"Polling GPIO{PIN} (physical pin {PHYSICAL_PIN}) for {seconds:.0f}s.\n"
        "Wave hand in front of the white dome (1–3 m).\n"
        "Expected: value 1 when motion, 0 when idle.\n"
        "If it stays 0 forever → wiring / wrong pin / sensor not powered.\n"
        "If it stays 1 forever → false trigger or OUT/GND swapped.\n",
        flush=True,
    )

    last = None
    high_count = 0
    t0 = time.monotonic()
    while time.monotonic() - t0 < seconds:
        v = 1 if inp.is_active else 0
        if v != last:
            print(f"  OUT = {v}  ({'MOTION' if v else 'idle'})", flush=True)
            last = v
        if v:
            high_count += 1
        time.sleep(0.15)

    inp.close()
    if high_count == 0:
        print("\nNo HIGH detected. Check wiring and sensor jumpers (use H).", flush=True)
        sys.exit(1)
    print(f"\nOK: saw motion signal ({high_count} samples high).", flush=True)


def motion_sensor_mode() -> None:
    from gpiozero import MotionSensor

    sensor = MotionSensor(PIN)
    sensor.when_motion = lambda: print("MOTION (gpiozero event)", flush=True)
    print(f"MotionSensor on GPIO{PIN}. Wave hand. Ctrl+C to stop.", flush=True)
    from signal import pause

    pause()


def main() -> None:
    try:
        import gpiozero  # noqa: F401
    except ImportError:
        print("sudo apt install -y python3-gpiozero python3-lgpio", file=sys.stderr)
        sys.exit(1)

    setup_pin_factory()

    if os.environ.get("MOTION_TEST_MODE", "poll").lower() == "event":
        motion_sensor_mode()
    else:
        poll_out_line()


if __name__ == "__main__":
    main()
