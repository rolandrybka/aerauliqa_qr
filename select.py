"""Select entities for Aerauliqa QR."""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    DOMAIN,
    FAN_SPEEDS,
    REGISTER_FAN_SPEED,
    REGISTER_WORKING_MODE,
    WORKING_MODES,
)
from .coordinator import AerauliqaQRCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up control selects from a config entry."""
    coordinator: AerauliqaQRCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        (
            AerauliqaQRSelect(
                coordinator,
                entry,
                "working_mode",
                "Working mode",
                REGISTER_WORKING_MODE,
                WORKING_MODES,
            ),
            AerauliqaQRSelect(
                coordinator,
                entry,
                "fan_speed",
                "Fan speed",
                REGISTER_FAN_SPEED,
                FAN_SPEEDS,
            ),
        )
    )


class AerauliqaQRSelect(CoordinatorEntity, SelectEntity):
    """Represent a writable QR operating setting."""

    def __init__(
        self,
        coordinator: AerauliqaQRCoordinator,
        entry: ConfigEntry,
        key: str,
        name: str,
        address: int,
        values: dict[int, str],
    ) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._key = key
        self._address = address
        self._values = values
        self._labels = {value: key for key, value in values.items()}
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_has_entity_name = True
        self._attr_name = name
        self._attr_options = list(values.values())

    @property
    def current_option(self) -> str | None:
        """Return the currently selected setting, if recognized."""
        return self._values.get(self.coordinator.data[self._key])

    async def async_select_option(self, option: str) -> None:
        """Write a valid operating setting."""
        if option not in self._labels:
            raise HomeAssistantError(f"Unsupported Aerauliqa QR option: {option}")
        numeric_value = self._labels[option]
        await self.coordinator.async_write_register(self._address, numeric_value)
        await self.coordinator.async_refresh_after_write()

    @property
    def device_info(self) -> DeviceInfo:
        """Group this entity under the ventilator device."""
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="Aerauliqa",
            model="QR heat-recovery ventilation unit",
        )
