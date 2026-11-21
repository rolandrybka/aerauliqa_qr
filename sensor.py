"""Sensors for Aerauliqa QR."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
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


@dataclass
class SensorDescription(SensorEntityDescription):
    """Description of a QR sensor."""

    address: int = 0
    scale: float = 1


SENSORS = (
    SensorDescription(
        key="hours",
        name="Working hours",
        address=REGISTER_HOURS,
        native_unit_of_measurement="h",
        device_class=SensorDeviceClass.DURATION,
        state_class=SensorStateClass.TOTAL_INCREASING,
    ),
    SensorDescription(
        key="fan_1",
        name="Fan 1 speed",
        address=REGISTER_FAN_1,
        native_unit_of_measurement="rpm",
    ),
    SensorDescription(
        key="fan_2",
        name="Fan 2 speed",
        address=REGISTER_FAN_2,
        native_unit_of_measurement="rpm",
    ),
    SensorDescription(
        key="t11",
        name="T11",
        address=REGISTER_T11,
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        device_class=SensorDeviceClass.TEMPERATURE,
        scale=0.1,
        native_precision=1,
    ),
    SensorDescription(
        key="t12",
        name="T12",
        address=REGISTER_T12,
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        device_class=SensorDeviceClass.TEMPERATURE,
        scale=0.1,
        native_precision=1,
    ),
    SensorDescription(
        key="t21",
        name="T21",
        address=REGISTER_T21,
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        device_class=SensorDeviceClass.TEMPERATURE,
        scale=0.1,
        native_precision=1,
    ),
    SensorDescription(
        key="t22",
        name="T22",
        address=REGISTER_T22,
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        device_class=SensorDeviceClass.TEMPERATURE,
        scale=0.1,
        native_precision=1,
    ),
    SensorDescription(
        key="sla",
        name="SLA analog input",
        address=REGISTER_SLA,
        native_unit_of_measurement="V",
        device_class=SensorDeviceClass.VOLTAGE,
        scale=0.1,
        native_precision=1,
    ),
    SensorDescription(
        key="s4",
        name="S4 analog input",
        address=REGISTER_S4,
        native_unit_of_measurement="V",
        device_class=SensorDeviceClass.VOLTAGE,
        scale=0.1,
        native_precision=1,
    ),
    SensorDescription(
        key="modbus_fw_major",
        name="Modbus firmware major",
        address=REGISTER_MODBUS_FW_MAJOR,
        state_class=None,
    ),
    SensorDescription(
        key="modbus_fw_minor",
        name="Modbus firmware minor",
        address=REGISTER_MODBUS_FW_MINOR,
        state_class=None,
    ),
    SensorDescription(
        key="ctrl_dsp_fw_major",
        name="CTRL-DSP firmware major",
        address=REGISTER_CTRL_DSP_FW_MAJOR,
        state_class=None,
    ),
    SensorDescription(
        key="ctrl_dsp_fw_minor",
        name="CTRL-DSP firmware minor",
        address=REGISTER_CTRL_DSP_FW_MINOR,
        state_class=None,
    ),
    SensorDescription(
        key="filter_countdown",
        name="Filter countdown",
        address=REGISTER_FILTER_COUNTDOWN,
        native_unit_of_measurement="d",
    ),
    SensorDescription(
        key="humidity",
        name="Relative humidity",
        address=REGISTER_HUMIDITY,
        native_unit_of_measurement="%",
        device_class=SensorDeviceClass.HUMIDITY,
        scale=0.1,
        native_precision=1,
    ),
    SensorDescription(
        key="fan_1_output",
        name="Fan 1 output",
        address=REGISTER_FAN_1_OUTPUT,
        native_unit_of_measurement="%",
        scale=0.1,
        native_precision=1,
    ),
    SensorDescription(
        key="fan_2_output",
        name="Fan 2 output",
        address=REGISTER_FAN_2_OUTPUT,
        native_unit_of_measurement="%",
        scale=0.1,
        native_precision=1,
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

    @property
    def native_value(self) -> int | float:
        """Return the latest sensor value."""
        value = self.coordinator.data[self.entity_description.key]
        return round(value * self.entity_description.scale, 1)

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
