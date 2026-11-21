"""Switch entity for the Aerauliqa QR operating state."""

from __future__ import annotations

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, REGISTER_WORKING_MODE
from .coordinator import AerauliqaQRCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the power switch from a config entry."""
    coordinator: AerauliqaQRCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([AerauliqaQRPowerSwitch(coordinator, entry)])


class AerauliqaQRPowerSwitch(CoordinatorEntity, SwitchEntity):
    """Turn the unit off or restore its last operating mode."""

    def __init__(
        self, coordinator: AerauliqaQRCoordinator, entry: ConfigEntry
    ) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_power"
        self._attr_has_entity_name = True
        self._attr_name = "Power"
        self._attr_icon = "mdi:hvac"

    @property
    def available(self) -> bool:
        """Keep the last successful power state visible during a poll failure."""
        return self.coordinator.data is not None

    @property
    def is_on(self) -> bool:
        """Return whether the unit is operating."""
        return self.coordinator.data["working_mode"] != 0

    async def async_turn_on(self, **kwargs: object) -> None:
        """Restore the last operating mode, or select 3V."""
        mode = self.coordinator.last_working_mode or 1
        await self.coordinator.async_write_register(REGISTER_WORKING_MODE, mode)
        await self.coordinator.async_refresh_after_write()

    async def async_turn_off(self, **kwargs: object) -> None:
        """Turn the unit off."""
        await self.coordinator.async_write_register(REGISTER_WORKING_MODE, 0)
        await self.coordinator.async_refresh_after_write()

    @property
    def extra_state_attributes(self) -> dict[str, bool | str | None]:
        """Expose Modbus data freshness."""
        return self.coordinator.status_attributes

    @property
    def device_info(self) -> DeviceInfo:
        """Group this entity under the ventilator device."""
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="Aerauliqa",
            model="QR heat-recovery ventilation unit",
        )
