"""GPIO setup for Pi OS Bookworm+ (lgpio). Import before other gpiozero devices."""

from __future__ import annotations


def setup_pin_factory() -> None:
    try:
        from gpiozero import Device
        from gpiozero.pins.lgpio import LGPIOFactory

        Device.pin_factory = LGPIOFactory()
    except ImportError:
        # Older images may work with default factory.
        pass
