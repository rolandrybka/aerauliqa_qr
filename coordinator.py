"""Modbus communication and shared update coordinator."""

from __future__ import annotations

from datetime import timedelta
import logging
from threading import Lock

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.update_coordinator import (
    DataUpdateCoordinator,
    UpdateFailed,
)
from pymodbus.client import ModbusSerialClient, ModbusTcpClient
from pymodbus.exceptions import ModbusException

from .const import (
    CONF_BAUDRATE,
    CONF_DEVICE,
    CONF_HOST,
    CONF_PARITY,
    CONF_PORT,
    CONF_SCAN_INTERVAL,
    CONF_SLAVE,
    CONF_STOPBITS,
    CONF_TRANSPORT,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    REGISTER_FAN_1,
    REGISTER_FAN_1_OUTPUT,
    REGISTER_FAN_2,
    REGISTER_FAN_2_OUTPUT,
    REGISTER_HOURS,
    REGISTER_SLA,
    REGISTER_S4,
    REGISTER_T11,
    REGISTER_T12,
    REGISTER_T21,
    REGISTER_T22,
    REGISTER_BST_INPUT,
    REGISTER_HY_INPUT,
    REGISTER_IAQ_INPUT,
    REGISTER_BYPASS_OUTPUT,
    REGISTER_DH_OUTPUT,
    REGISTER_HEAT_OUTPUT,
    REGISTER_ANTI_FROST,
    REGISTER_MODBUS_FW_MAJOR,
    REGISTER_MODBUS_FW_MINOR,
    REGISTER_CTRL_DSP_FW_MAJOR,
    REGISTER_CTRL_DSP_FW_MINOR,
    REGISTER_E000,
    REGISTER_E001,
    REGISTER_E002,
    REGISTER_E003,
    REGISTER_E004,
    REGISTER_E005,
    REGISTER_E006,
    REGISTER_E007,
    REGISTER_E008,
    REGISTER_FILTER_COUNTDOWN,
    REGISTER_FILTER_ALARM,
    REGISTER_BOOST_ACTIVE,
    REGISTER_HUMIDITY,
    REGISTER_WORKING_MODE,
    TRANSPORT_SERIAL,
)

_LOGGER = logging.getLogger(__name__)


class AerauliqaQRCoordinator(DataUpdateCoordinator):
    """Poll the unit and expose safe register writes to its entities."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.entry = entry
        self.config = {**entry.data, **entry.options}
        self.slave = self.config[CONF_SLAVE]
        self._client_lock = Lock()
        self.client = self._create_client()
        self.last_working_mode = 1
        super().__init__(
            hass,
            _LOGGER,
            name=f"{DOMAIN}_{entry.entry_id}",
            update_interval=timedelta(
                seconds=self.config.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
            ),
        )

    def _create_client(self):
        """Create a client for the selected transport."""
        if self.config[CONF_TRANSPORT] == TRANSPORT_SERIAL:
            return ModbusSerialClient(
                port=self.config[CONF_DEVICE],
                baudrate=self.config[CONF_BAUDRATE],
                parity=self.config[CONF_PARITY],
                stopbits=self.config[CONF_STOPBITS],
                bytesize=8,
                timeout=3,
            )
        return ModbusTcpClient(
            self.config[CONF_HOST],
            port=self.config[CONF_PORT],
            timeout=3,
        )

    async def _async_update_data(self) -> dict[str, int]:
        """Read the input registers without blocking Home Assistant."""
        try:
            return await self.hass.async_add_executor_job(self._read_registers)
        except Exception as err:
            raise UpdateFailed(f"Unable to read Aerauliqa QR registers: {err}") from err

    def _read_registers(self) -> dict[str, int]:
        """Read registers and reconnect once when the connection has gone stale."""
        with self._client_lock:
            for attempt in range(2):
                try:
                    return self._read_registers_locked()
                except (ModbusException, OSError, TimeoutError) as err:
                    self.client.close()
                    if attempt:
                        raise
                    _LOGGER.warning(
                        "Aerauliqa QR Modbus poll failed; reconnecting and "
                        "retrying once: %s",
                        err,
                    )

        raise UpdateFailed("Aerauliqa QR Modbus read failed after reconnect")

    def _read_registers_locked(self) -> dict[str, int]:
        """Read registers while the client lock is held."""
        if not self.client.connect():
            raise ConnectionError("Could not connect to the Modbus device")

        ventilation = self.client.read_holding_registers(
            REGISTER_HOURS,
            count=REGISTER_FAN_2_OUTPUT - REGISTER_HOURS + 1,
            slave=self.slave,
        )
        if ventilation.isError():
            raise ConnectionError(
                f"Modbus read failed at {REGISTER_HOURS}: {ventilation}"
            )

        controls = self.client.read_holding_registers(
            REGISTER_WORKING_MODE, count=2, slave=self.slave
        )
        if controls.isError():
            raise ConnectionError(
                f"Modbus read failed at {REGISTER_WORKING_MODE}: {controls}"
            )

        expected_count = REGISTER_FAN_2_OUTPUT - REGISTER_HOURS + 1
        if (
            len(ventilation.registers) != expected_count
            or len(controls.registers) != 2
        ):
            raise ConnectionError("Modbus device returned an incomplete register block")

        values = ventilation.registers

        def register(address: int) -> int:
            return values[address - REGISTER_HOURS]

        data = {
            "hours": self._decode_hours(
                register(REGISTER_HOURS), register(REGISTER_HOURS + 1)
            ),
            "fan_1": register(REGISTER_FAN_1),
            "fan_2": register(REGISTER_FAN_2),
            "t11": register(REGISTER_T11),
            "t12": register(REGISTER_T12),
            "t21": register(REGISTER_T21),
            "t22": register(REGISTER_T22),
            "sla": register(REGISTER_SLA),
            "s4": register(REGISTER_S4),
            "bst_input": register(REGISTER_BST_INPUT),
            "hy_input": register(REGISTER_HY_INPUT),
            "iaq_input": register(REGISTER_IAQ_INPUT),
            "bypass_output": register(REGISTER_BYPASS_OUTPUT),
            "dh_output": register(REGISTER_DH_OUTPUT),
            "heat_output": register(REGISTER_HEAT_OUTPUT),
            "anti_frost": register(REGISTER_ANTI_FROST),
            "modbus_fw_major": register(REGISTER_MODBUS_FW_MAJOR),
            "modbus_fw_minor": register(REGISTER_MODBUS_FW_MINOR),
            "ctrl_dsp_fw_major": register(REGISTER_CTRL_DSP_FW_MAJOR),
            "ctrl_dsp_fw_minor": register(REGISTER_CTRL_DSP_FW_MINOR),
            "e000": register(REGISTER_E000),
            "e001": register(REGISTER_E001),
            "e002": register(REGISTER_E002),
            "e003": register(REGISTER_E003),
            "e004": register(REGISTER_E004),
            "e005": register(REGISTER_E005),
            "e006": register(REGISTER_E006),
            "e007": register(REGISTER_E007),
            "e008": register(REGISTER_E008),
            "filter_countdown": register(REGISTER_FILTER_COUNTDOWN),
            "filter_alarm": register(REGISTER_FILTER_ALARM),
            "boost_active": register(REGISTER_BOOST_ACTIVE),
            "humidity": register(REGISTER_HUMIDITY),
            "fan_1_output": register(REGISTER_FAN_1_OUTPUT),
            "fan_2_output": register(REGISTER_FAN_2_OUTPUT),
            "working_mode": controls.registers[0],
            "fan_speed": controls.registers[1],
        }
        if data["working_mode"] in (1, 2, 3, 4):
            self.last_working_mode = data["working_mode"]
        return data

    @staticmethod
    def _decode_hours(low_register: int, high_register: int) -> int:
        """Decode the manual's LSB-first 32-bit hours counter."""
        return (
            ((low_register >> 8) & 0xFF)
            | ((low_register & 0xFF) << 8)
            | (((high_register >> 8) & 0xFF) << 16)
            | ((high_register & 0xFF) << 24)
        )

    async def async_write_register(self, address: int, value: int) -> None:
        """Write one documented control register."""
        try:
            await self.hass.async_add_executor_job(
                self._write_register, address, value
            )
        except Exception as err:
            raise HomeAssistantError(
                f"Unable to write Aerauliqa QR register {address}: {err}"
            ) from err

    def _write_register(self, address: int, value: int) -> None:
        """Perform the blocking Modbus write."""
        with self._client_lock:
            try:
                if not self.client.connect():
                    raise ConnectionError("Could not connect to the Modbus device")
                response = self.client.write_register(
                    address=address,
                    value=value,
                    slave=self.slave,
                )
                if response.isError():
                    raise ConnectionError(
                        f"Modbus write failed at {address}: {response}"
                    )
            except Exception:
                self.client.close()
                raise

    async def async_refresh_after_write(self) -> None:
        """Refresh state after a successful control write."""
        await self.async_request_refresh()

    async def async_close(self) -> None:
        """Close the Modbus connection."""
        await self.hass.async_add_executor_job(self._close_client)

    def _close_client(self) -> None:
        """Close the client after any in-flight operation."""
        with self._client_lock:
            self.client.close()
