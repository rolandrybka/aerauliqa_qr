"""Sensors for Aerauliqa QR."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    DOMAIN,
    REGISTER_ANTI_FROST,
    REGISTER_CTRL_DSP_FW_MAJOR,
    REGISTER_CTRL_DSP_FW_MINOR,
    REGISTER_DH_OUTPUT,
    REGISTER_FAN_1,
    REGISTER_FAN_2,
    REGISTER_FAN_1_OUTPUT,
    REGISTER_FAN_2_OUTPUT,
    REGISTER_FILTER_COUNTDOWN,
    REGISTER_HOURS,
    REGISTER_HEAT_OUTPUT,
    REGISTER_HUMIDITY,
    REGISTER_MODBUS_FW_MAJOR,
    REGISTER_MODBUS_FW_MINOR,
    REGISTER_S4,
    REGISTER_SLA,
    REGISTER_T11,
    REGISTER_T12,
    REGISTER_T21,
    REGISTER_T22,
)
from .coordinator import AerauliqaQRCoordinator


@dataclass(frozen=True)
class SensorDescription:
    """Description of a QR sensor."""

    key: str
    name: str
    address: int
    unit: str
    device_class: SensorDeviceClass | None = None
    scale: float = 1
    state_class: SensorStateClass | None = SensorStateClass.MEASUREMENT


SENSORS = (
    SensorDescription(
        "hours",
        "Working hours",
        REGISTER_HOURS,
        "h",
        SensorDeviceClass.DURATION,
        state_class=SensorStateClass.TOTAL_INCREASING,
    ),
    SensorDescription("fan_1", "Fan 1 speed", REGISTER_FAN_1, "rpm"),
    SensorDescription("fan_2", "Fan 2 speed", REGISTER_FAN_2, "rpm"),
    SensorDescription(
        "t11",
        "T11",
        REGISTER_T11,
        UnitOfTemperature.CELSIUS,
        SensorDeviceClass.TEMPERATURE,
        0.1,
    ),
    SensorDescription(
        "t12",
        "T12",
        REGISTER_T12,
        UnitOfTemperature.CELSIUS,
        SensorDeviceClass.TEMPERATURE,
        0.1,
    ),
    SensorDescription(
        "t21",
        "T21",
        REGISTER_T21,
        UnitOfTemperature.CELSIUS,
        SensorDeviceClass.TEMPERATURE,
        0.1,
    ),
    SensorDescription(
        "t22",
        "T22",
        REGISTER_T22,
        UnitOfTemperature.CELSIUS,
        SensorDeviceClass.TEMPERATURE,
        0.1,
    ),
    SensorDescription(
        "sla",
        "SLA analog input",
        REGISTER_SLA,
        "V",
        SensorDeviceClass.VOLTAGE,
        0.1,
    ),
    SensorDescription(
        "s4", "S4 analog input", REGISTER_S4, "V", SensorDeviceClass.VOLTAGE, 0.1
    ),
    SensorDescription(
        "modbus_fw_major",
        "Modbus firmware major",
        REGISTER_MODBUS_FW_MAJOR,
        "",
        state_class=None,
    ),
    SensorDescription(
        "modbus_fw_minor",
        "Modbus firmware minor",
        REGISTER_MODBUS_FW_MINOR,
        "",
        state_class=None,
    ),
    SensorDescription(
        "ctrl_dsp_fw_major",
        "CTRL-DSP firmware major",
        REGISTER_CTRL_DSP_FW_MAJOR,
        "",
        state_class=None,
    ),
    SensorDescription(
        "ctrl_dsp_fw_minor",
        "CTRL-DSP firmware minor",
        REGISTER_CTRL_DSP_FW_MINOR,
        "",
        state_class=None,
    ),
    SensorDescription(
        "filter_countdown",
        "Filter countdown",
        REGISTER_FILTER_COUNTDOWN,
        "d",
    ),
    SensorDescription(
        "humidity",
        "Relative humidity",
        REGISTER_HUMIDITY,
        "%",
        SensorDeviceClass.HUMIDITY,
        scale=0.1,
    ),
    SensorDescription(
        "fan_1_output", "Fan 1 output", REGISTER_FAN_1_OUTPUT, "%", scale=0.1
    ),
    SensorDescription(
        "fan_2_output", "Fan 2 output", REGISTER_FAN_2_OUTPUT, "%", scale=0.1
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up sensors from a config entry."""
    coordinator: AerauliqaQRCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        AerauliqaQRSensor(coordinator, entry, description) for description in SENSORS
    )


class AerauliqaQRSensor(CoordinatorEntity, SensorEntity):
    """Represent a QR measurement."""

    entity_description: SensorDescription

    def __init__(
        self,
        coordinator: AerauliqaQRCoordinator,
        entry: ConfigEntry,
        description: SensorDescription,
    ) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_has_entity_name = True
        self._attr_name = description.name

    @property
    def native_value(self) -> int | float:
        """Return the latest sensor value."""
        value = self.coordinator.data[self.entity_description.key]
        return round(value * self.entity_description.scale, 1)

    @property
    def native_unit_of_measurement(self) -> str | None:
        """Return the measurement unit."""
        return self.entity_description.unit or None

    @property
    def device_class(self) -> SensorDeviceClass | None:
        """Return the measurement device class."""
        return self.entity_description.device_class

    @property
    def state_class(self) -> SensorStateClass | None:
        """Return the measurement state class."""
        return self.entity_description.state_class

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
