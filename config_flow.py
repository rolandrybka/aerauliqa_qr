"""Config and options flows for the Aerauliqa QR integration."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_NAME
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from pymodbus.client import ModbusSerialClient, ModbusTcpClient

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
    DEFAULT_BAUDRATE,
    DEFAULT_PORT,
    DEFAULT_SCAN_INTERVAL,
    DEFAULT_SLAVE,
    DOMAIN,
    MAX_SCAN_INTERVAL,
    MIN_SCAN_INTERVAL,
    REGISTER_WORKING_MODE,
    TRANSPORT_SERIAL,
    TRANSPORT_TCP,
)

_LOGGER = logging.getLogger(__name__)
TRANSPORTS = {TRANSPORT_TCP: "Modbus TCP", TRANSPORT_SERIAL: "Modbus RTU (RS485)"}
BAUDRATES = (9600, 19200, 38400)


def _transport_schema() -> vol.Schema:
    """Build the initial transport selection form."""
    return vol.Schema(
        {
            vol.Required(CONF_NAME, default="Aerauliqa QR"): str,
            vol.Required(CONF_TRANSPORT, default=TRANSPORT_TCP): vol.In(TRANSPORTS),
            vol.Required(CONF_SLAVE, default=DEFAULT_SLAVE): vol.All(
                vol.Coerce(int), vol.Range(min=1, max=247)
            ),
        }
    )


def _tcp_schema(defaults: dict[str, Any]) -> vol.Schema:
    """Build the TCP connection form schema."""
    return vol.Schema(
        {
            vol.Required(CONF_HOST, default=defaults.get(CONF_HOST, "")): str,
            vol.Required(
                CONF_PORT, default=defaults.get(CONF_PORT, DEFAULT_PORT)
            ): vol.All(vol.Coerce(int), vol.Range(min=1, max=65535)),
        }
    )


def _serial_schema(defaults: dict[str, Any]) -> vol.Schema:
    """Build the serial connection form schema."""
    return vol.Schema(
        {
            vol.Required(CONF_DEVICE, default=defaults.get(CONF_DEVICE, "")): str,
            vol.Optional(
                CONF_BAUDRATE,
                default=defaults.get(CONF_BAUDRATE, DEFAULT_BAUDRATE),
            ): vol.In(BAUDRATES),
            vol.Optional(CONF_PARITY, default=defaults.get(CONF_PARITY, "N")): vol.In(
                ("N", "E", "O")
            ),
            vol.Optional(CONF_STOPBITS, default=defaults.get(CONF_STOPBITS, 1)): vol.In(
                (1, 2)
            ),
        }
    )


def _options_schema(defaults: dict[str, Any]) -> vol.Schema:
    """Build the polling interval options form schema."""
    return vol.Schema(
        {
            vol.Required(
                CONF_SCAN_INTERVAL,
                default=defaults.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL),
            ): vol.All(
                vol.Coerce(int),
                vol.Range(min=MIN_SCAN_INTERVAL, max=MAX_SCAN_INTERVAL),
            )
        }
    )


def _create_client(config: dict[str, Any]) -> ModbusTcpClient | ModbusSerialClient:
    """Create a temporary client used to validate a connection."""
    if config[CONF_TRANSPORT] == TRANSPORT_SERIAL:
        return ModbusSerialClient(
            port=config[CONF_DEVICE],
            baudrate=config[CONF_BAUDRATE],
            parity=config[CONF_PARITY],
            stopbits=config[CONF_STOPBITS],
            bytesize=8,
            timeout=3,
        )
    return ModbusTcpClient(config[CONF_HOST], port=config[CONF_PORT], timeout=3)


def _validate_connection(config: dict[str, Any]) -> None:
    """Test connectivity and verify the configured unit ID."""
    client = _create_client(config)
    try:
        if not client.connect():
            raise ConnectionError("Could not connect to the Modbus device")
        response = client.read_holding_registers(
            REGISTER_WORKING_MODE, count=2, slave=config[CONF_SLAVE]
        )
        if response.isError():
            raise ConnectionError(
                f"Modbus device rejected the register read: {response}"
            )
        if len(response.registers) != 2:
            raise ConnectionError("Modbus device returned an incomplete register block")
    finally:
        client.close()


async def _async_validate_connection(
    hass: HomeAssistant, config: dict[str, Any]
) -> None:
    """Validate a device in an executor to keep the event loop responsive."""
    try:
        await hass.async_add_executor_job(_validate_connection, config)
    except Exception as err:
        _LOGGER.debug("Could not connect to Aerauliqa QR device: %s", err)
        raise HomeAssistantError(str(err)) from err


class AerauliqaQRConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Aerauliqa QR."""

    VERSION = 1

    def __init__(self) -> None:
        self._name = "Aerauliqa QR"
        self._transport = TRANSPORT_TCP
        self._slave = DEFAULT_SLAVE

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.FlowResult:
        """Select a connection type."""
        if user_input is not None:
            self._name = user_input[CONF_NAME]
            self._transport = user_input[CONF_TRANSPORT]
            self._slave = user_input[CONF_SLAVE]
            if self._transport == TRANSPORT_SERIAL:
                return await self.async_step_serial()
            return await self.async_step_tcp()
        return self.async_show_form(
            step_id="user", data_schema=_transport_schema()
        )

    async def async_step_tcp(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.FlowResult:
        """Configure and validate a TCP connection."""
        errors: dict[str, str] = {}
        if user_input is not None:
            config = {
                **user_input,
                CONF_TRANSPORT: TRANSPORT_TCP,
                CONF_SLAVE: self._slave,
            }
            if not config[CONF_HOST].strip():
                errors["base"] = "invalid_host"
            else:
                try:
                    await _async_validate_connection(self.hass, config)
                except HomeAssistantError:
                    errors["base"] = "cannot_connect"
                else:
                    await self._set_unique_id(config)
                    return self.async_create_entry(title=self._name, data=config)
        return self.async_show_form(
            step_id="tcp", data_schema=_tcp_schema(user_input or {}), errors=errors
        )

    async def async_step_serial(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.FlowResult:
        """Configure and validate an RTU/RS485 connection."""
        errors: dict[str, str] = {}
        if user_input is not None:
            config = {
                **user_input,
                CONF_TRANSPORT: TRANSPORT_SERIAL,
                CONF_SLAVE: self._slave,
            }
            if not config[CONF_DEVICE].strip():
                errors["base"] = "invalid_device"
            else:
                try:
                    await _async_validate_connection(self.hass, config)
                except HomeAssistantError:
                    errors["base"] = "cannot_connect"
                else:
                    await self._set_unique_id(config)
                    return self.async_create_entry(title=self._name, data=config)
        return self.async_show_form(
            step_id="serial",
            data_schema=_serial_schema(user_input or {}),
            errors=errors,
        )

    async def _set_unique_id(self, config: dict[str, Any]) -> None:
        """Abort if this Modbus endpoint is already configured."""
        endpoint = config.get(CONF_HOST, config.get(CONF_DEVICE))
        await self.async_set_unique_id(
            f"{config[CONF_TRANSPORT]}_{endpoint}_"
            f"{config.get(CONF_PORT, DEFAULT_PORT)}_{config[CONF_SLAVE]}"
        )
        self._abort_if_unique_id_configured()

    @staticmethod
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> AerauliqaQROptionsFlow:
        """Get the options flow."""
        return AerauliqaQROptionsFlow(config_entry)


class AerauliqaQROptionsFlow(config_entries.OptionsFlow):
    """Adjust the polling interval."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.FlowResult:
        """Set the update interval."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        defaults = {**self.config_entry.data, **self.config_entry.options}
        return self.async_show_form(
            step_id="init", data_schema=_options_schema(defaults)
        )
