"""Binary sensors for Aerauliqa QR inputs, outputs, and alarms."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    DOMAIN,
    REGISTER_ANTI_FROST,
    REGISTER_BOOST_ACTIVE,
    REGISTER_BST_INPUT,
    REGISTER_BYPASS_OUTPUT,
    REGISTER_DH_OUTPUT,
    REGISTER_E000,
    REGISTER_E001,
    REGISTER_E002,
    REGISTER_E003,
    REGISTER_E004,
    REGISTER_E005,
    REGISTER_E006,
    REGISTER_E007,
    REGISTER_E008,
    REGISTER_FILTER_ALARM,
    REGISTER_HEAT_OUTPUT,
    REGISTER_HY_INPUT,
    REGISTER_IAQ_INPUT,
)
from .coordinator import AerauliqaQRCoordinator


@dataclass(frozen=True)
class BinarySensorDescription:
    """Description of a QR binary sensor."""

    key: str
    name: str
    address: int
    device_class: BinarySensorDeviceClass | None = None


BINARY_SENSORS = (
    BinarySensorDescription("bst_input", "BST input active", REGISTER_BST_INPUT),
    BinarySensorDescription("hy_input", "HY input active", REGISTER_HY_INPUT),
    BinarySensorDescription("iaq_input", "IAQ input active", REGISTER_IAQ_INPUT),
    BinarySensorDescription(
        "bypass_output", "Bypass output active", REGISTER_BYPASS_OUTPUT
    ),
    BinarySensorDescription("dh_output", "DH output active", REGISTER_DH_OUTPUT),
    BinarySensorDescription("heat_output", "HEAT output active", REGISTER_HEAT_OUTPUT),
    BinarySensorDescription("anti_frost", "Anti-frost active", REGISTER_ANTI_FROST),
    BinarySensorDescription(
        "e000",
        "E000 - RS485 communication alarm",
        REGISTER_E000,
        BinarySensorDeviceClass.PROBLEM,
    ),
    BinarySensorDescription(
        "e001",
        "E001 - Extract fan fault",
        REGISTER_E001,
        BinarySensorDeviceClass.PROBLEM,
    ),
    BinarySensorDescription(
        "e002",
        "E002 - Supply fan fault",
        REGISTER_E002,
        BinarySensorDeviceClass.PROBLEM,
    ),
    BinarySensorDescription(
        "e003",
        "E003 - T11 probe fault",
        REGISTER_E003,
        BinarySensorDeviceClass.PROBLEM,
    ),
    BinarySensorDescription(
        "e004",
        "E004 - T12 probe fault",
        REGISTER_E004,
        BinarySensorDeviceClass.PROBLEM,
    ),
    BinarySensorDescription(
        "e005",
        "E005 - T21 probe fault",
        REGISTER_E005,
        BinarySensorDeviceClass.PROBLEM,
    ),
    BinarySensorDescription(
        "e006",
        "E006 - T22 probe fault",
        REGISTER_E006,
        BinarySensorDeviceClass.PROBLEM,
    ),
    BinarySensorDescription(
        "e007",
        "E007 - Dehumidifier alarm",
        REGISTER_E007,
        BinarySensorDeviceClass.PROBLEM,
    ),
    BinarySensorDescription(
        "e008",
        "E008 - CTRL-DSP internal error",
        REGISTER_E008,
        BinarySensorDeviceClass.PROBLEM,
    ),
    BinarySensorDescription(
        "filter_alarm",
        "Filter alarm active",
        REGISTER_FILTER_ALARM,
        BinarySensorDeviceClass.PROBLEM,
    ),
    BinarySensorDescription(
        "boost_active", "Boost cycle active", REGISTER_BOOST_ACTIVE
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up binary sensors from a config entry."""
    coordinator: AerauliqaQRCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        AerauliqaQRBinarySensor(coordinator, entry, description)
        for description in BINARY_SENSORS
    )


class AerauliqaQRBinarySensor(CoordinatorEntity, BinarySensorEntity):
    """Represent a QR binary input, output, or alarm."""

    def __init__(
        self,
        coordinator: AerauliqaQRCoordinator,
        entry: ConfigEntry,
        description: BinarySensorDescription,
    ) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_has_entity_name = True
        self._attr_name = description.name
        self._attr_device_class = description.device_class

    @property
    def is_on(self) -> bool:
        """Return whether the input, output, or alarm is active."""
        return bool(self.coordinator.data[self.entity_description.key])

    @property
    def extra_state_attributes(self) -> dict[str, int]:
        """Expose the corresponding Modbus register."""
        return {"register": self.entity_description.address}

    @property
    def device_info(self) -> DeviceInfo:
        """Group all entities under the ventilator device."""
        return DeviceInfo(
            identifiers={(DOMAIN, self._entry.entry_id)},
            name=self._entry.title,
            manufacturer="Aerauliqa",
            model="QR heat-recovery ventilation unit",
        )
