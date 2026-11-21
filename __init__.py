"""Aerauliqa QR heat-recovery ventilation integration."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN, PLATFORMS
from .coordinator import AerauliqaQRCoordinator


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Set up the integration and publish its Lovelace card."""
    hass.http.register_static_path(
        f"/{DOMAIN}",
        str(Path(__file__).parent / "www"),
        cache_headers=True,
    )
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up a configured Aerauliqa QR unit."""
    coordinator = AerauliqaQRCoordinator(hass, entry)
    try:
        await coordinator.async_config_entry_first_refresh()
        hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    except Exception:
        hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
        await coordinator.async_close()
        raise
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload the integration when its options change."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a configured unit."""
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False

    coordinator: AerauliqaQRCoordinator = hass.data[DOMAIN].pop(entry.entry_id)
    await coordinator.async_close()
    if not hass.data[DOMAIN]:
        hass.data.pop(DOMAIN)
    return True
