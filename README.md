# Aerauliqa QR

Home Assistant integration for Aerauliqa QR heat-recovery ventilators. It
supports Modbus TCP gateways as well as a local Modbus RTU/RS485 adapter.
The integration is designed for Home Assistant 2023.2.0 and newer.

## Installation

1. Install this repository as a HACS custom integration, or copy its contents
   into `custom_components/aerauliqa_qr`.
2. Restart Home Assistant.
3. Go to **Settings → Devices & services → Add integration** and search for
   **Aerauliqa QR**.
4. Choose TCP or RTU and enter the connection details. The RTU defaults are
   9600 baud, 8 data bits, no parity and 1 stop bit, as described in
   `Modbus_QR.pdf`. Set the unit ID to the value configured on the unit.
5. Adjust the polling interval in the integration options if desired
   (5–3600 seconds; default 30 seconds).

If upgrading from the old YAML sensor platform, remove its
`sensor: - platform: aerauliqa_qr` configuration and included `sensors.yaml`
before restarting, then add the integration through the UI. The UI integration
replaces the old YAML-only platform.

The unit must be connected to the CTRL-DSP terminal's ModBus A/B pins for
RS485 communication. Home Assistant needs access to the serial adapter when
using RTU. If a TCP-to-RS485 gateway is used, choose TCP and enter its address
and port.

## Entities

The integration creates one device with:

- Temperature sensors T11, T12, T21 and T22
- Fan 1 and Fan 2 RPM sensors and a working-hours sensor
- A power switch (off writes working mode `0`; on restores the last active
  working mode, or selects `3V` after a restart)
- A working-mode select (`3V`, `Holiday`, `Constant pressure`, `Slave`)
- A fan-speed select (`Speed 1`–`Speed 3`)

All Modbus reads and writes run outside Home Assistant's event loop. Read and
write errors are reported by the coordinator and entities are updated from a
shared polling cycle. If a poll fails after a successful read, entities retain
the last known values and stay available until fresh values arrive. Their
`modbus_stale` attribute becomes `true`, and `last_successful_update` shows
when the displayed data was last refreshed. The Lovelace card also indicates
stale data. Before the first successful read, entities remain unavailable.
Temperature registers use the documented 0.1 °C scale.
If a TCP gateway closes an idle connection between polls, the integration
closes the stale socket and retries one failed read on a fresh connection
before marking the device unavailable.

## Lovelace card

The integration serves its companion card at
`/aerauliqa_qr/aerauliqa-qr-card.js`.

1. In **Settings → Dashboards → Resources**, add that URL as a JavaScript module.
2. Add a **Manual** card and paste a configuration like this. Replace entity
   IDs with the IDs shown on your device page.

```yaml
type: custom:aerauliqa-qr-card
name: Aerauliqa QR
power_entity: switch.aerauliqa_qr_power
fan_speed_entity: select.aerauliqa_qr_fan_speed
working_mode_entity: select.aerauliqa_qr_working_mode
temperatures:
  T11: sensor.aerauliqa_qr_t11
  T12: sensor.aerauliqa_qr_t12
  T21: sensor.aerauliqa_qr_t21
  T22: sensor.aerauliqa_qr_t22
```

The power, fan-speed and working-mode entities are required; temperatures are
optional. The card uses only Home Assistant's built-in frontend APIs and has
no external JavaScript dependencies.

## Modbus register map

The register map below is transcribed from pages 2–3 of `Modbus_QR.pdf`.
Addresses are shown in hexadecimal as in the document; decimal addresses are
shown in parentheses. `R` and `W` indicate the document's read and write
permissions. `—` means the PDF does not specify a default.

### Operating settings (page 2)

| Hex (decimal) | R/W | Description | Unit / values | Default |
|---|---|---|---|---:|
| `0x0200` (512) | RW | Working mode | 0 Off; 1 3V; 2 Holiday; 3 Constant pressure; 4 Slave | 1 |
| `0x0201` (513) | RW | Selected speed | 0 Speed 1; 1 Speed 2; 2 Speed 3 | 0 |
| `0x0202` (514) | W | Boost trigger | Boolean; write true to start, or stop if already active; reads back 0 | false |
| `0x0203` (515) | RW | Boost timeout | minutes | 15 |
| `0x0205` (517) | W | Reset filter countdown | Boolean trigger; reads back 0 | false |
| `0x0209` (521) | RW | Selected language | 0 English; 1 Italian; 2 German; 3 Czech; 4 Slovak; 5 French; 6 Spanish; 7 Dutch; 8 Chinese; 9 Hungarian; 10 Russian | 0 |
| `0x020B` (523) | RW | Orientation | false left; true right | false |
| `0x0210` (528) | RW | Bypass desired temperature | 0.1 °C | 230 (23 °C) |
| `0x0211` (529) | RW | Bypass Tmax free heating | 0.1 °C | 280 (28 °C) |
| `0x0212` (530) | RW | Bypass Tmin free cooling | 0.1 °C | 180 (18 °C) |
| `0x0214` (532) | RW | Heating function | 0 Off; 1 Pre; 2 Post | 0 |
| `0x0215` (533) | RW | Heating threshold (Pre) | 0.1 °C | — |
| `0x0216` (534) | RW | Heating threshold (Post) | 0.1 °C | 200 |
| `0x0217` (535) | RW | Reference temperature (Post) | 0 T11; 1 T22 | 0 |
| `0x021B` (539) | RW | Speed 1 value | % | 40 |
| `0x021C` (540) | RW | Speed 2 value | % | 70 |
| `0x021D` (541) | RW | Speed 3 value | % | 100 |
| `0x021E` (542) | RW | Boost speed value | % | 100 |
| `0x021F` (543) | RW | Holiday speed value | % | 20 |
| `0x0222` (546) | RW | Speed 1 extract balancing | % | 0 |
| `0x0223` (547) | RW | Speed 1 supply balancing | % | 0 |
| `0x0224` (548) | RW | Speed 2 extract balancing | % | 0 |
| `0x0225` (549) | RW | Speed 2 supply balancing | % | 0 |
| `0x0226` (550) | RW | Speed 3 extract balancing | % | 0 |
| `0x0227` (551) | RW | Speed 3 supply balancing | % | 0 |
| `0x0228` (552) | RW | Boost extract balancing | % | 0 |
| `0x0229` (553) | RW | Boost supply balancing | % | 0 |
| `0x022B` (555) | RW | F7 filter installed | Boolean | false |
| `0x022D` (557) | RW | Filter alarm interval | months | 3 |
| `0x022E` (558) | RW | Humidity threshold | 0.1 % | 800 (80.0 %) |
| `0x0231` (561) | RW | Pressure sensor range maximum | Pa | 300 |
| `0x0232` (562) | RW | Pressure setpoint | Pa | 100 |
| `0x0233` (563) | RW | PID control | 0 Normal; 1 Slow; 2 Fast; 3 Custom | 0 |
| `0x0234` (564) | RW | Custom PID global gain | 0.1 | 5 (0.5 for Normal PID) |
| `0x0235` (565) | RW | Custom PID proportional band | Pa | 100 |
| `0x0236` (566) | RW | Custom PID integration time | s | 10 |
| `0x0237` (567) | RW | Custom PID derivation time | s | 0 |
| `0x024F` (591) | RW | Modbus address | 1–247 | 1 |
| `0x0250` (592) | RW | Modbus baud-rate setting | 1 9600; 2 19200; 3 38400 bps | 1 |
| `0x0251` (593) | RW | Modbus parity setting | 1 None; 2 Odd; 3 Even | 1 |
| `0x0252` (594) | RW | Modbus stop bits | 1 or 2 | 1 |
| `0x0256` (598) | RW | Advanced speed balance | Boolean | false |
| `0x0257` (599) | RW | Minimum fan 1 speed | %; Constant Pressure mode only | 10 |
| `0x0258` (600) | RW | Maximum fan 1 speed | %; Constant Pressure mode only | 100 |
| `0x0259` (601) | RW | Minimum fan 2 speed | %; Constant Pressure mode only | 10 |
| `0x025A` (602) | RW | Maximum fan 2 speed | %; Constant Pressure mode only | 100 |

Registers `0x0202` and `0x0205` are write-only triggers; the manual says reads
return zero. The serial baud rate, parity and stop-bit *register values* are
enumerations, not the physical serial settings. The RTU connection form uses
the corresponding actual baud rate, parity and stop-bit values. Changes to
the unit's Modbus communication settings may require a power cycle, as
described in the manual.

### Measurements, inputs, outputs and alarms (pages 2–3)

| Hex (decimal) | R/W | Description | Unit / interpretation | Default |
|---|---|---|---|---:|
| `0x0100–0x0101` (256–257) | R | Working-hours counter | 32-bit hours; LSB-first encoding (`0x6E00` = 110 hours) | — |
| `0x0102` (258) | R | Fan 1 speed | rpm | — |
| `0x0103` (259) | R | Fan 2 speed | rpm | — |
| `0x0104` (260) | R | T11 | 0.1 °C | — |
| `0x0105` (261) | R | T12 | 0.1 °C | — |
| `0x0106` (262) | R | T21 | 0.1 °C | — |
| `0x0107` (263) | R | T22 | 0.1 °C | — |
| `0x0108` (264) | R | SLA analog input | 0.1 V | — |
| `0x0109` (265) | R | S4 analog input | 0.1 V | — |
| `0x010A` (266) | R | BST input active | Boolean | — |
| `0x010B` (267) | R | HY input active | Boolean | — |
| `0x010C` (268) | R | IAQ input active | Boolean | — |
| `0x010D` (269) | R | Bypass output active | Boolean | — |
| `0x010E` (270) | R | DH output active | Boolean | — |
| `0x010F` (271) | R | HEAT output active | Boolean | — |
| `0x0110` (272) | R | Anti-frost active | Boolean | — |
| `0x0111–0x0112` (273–274) | R | Modbus firmware major/minor | Version components | — |
| `0x0113–0x0114` (275–276) | R | CTRL-DSP firmware major/minor | Version components | — |
| `0x0115` (277) | R | E000 alarm active | No RS485 communication | false |
| `0x0116` (278) | R | E001 alarm active | Extract fan fault | false |
| `0x0117` (279) | R | E002 alarm active | Supply fan fault | false |
| `0x0118` (280) | R | E003 alarm active | T11 probe fault | false |
| `0x0119` (281) | R | E004 alarm active | T12 probe fault | false |
| `0x011A` (282) | R | E005 alarm active | T21 probe fault | false |
| `0x011B` (283) | R | E006 alarm active | T22 probe fault | false |
| `0x011C` (284) | R | E007 alarm active | Dehumidifier alarm via BST input | false |
| `0x011D` (285) | R | E008 alarm active | CTRL-DSP internal error | false |
| `0x011E` (286) | R | Filter countdown | days remaining | — |
| `0x011F` (287) | R | Filter alarm active | Boolean | false |
| `0x0120` (288) | R | Boost active | Boolean | false |
| `0x0121` (289) | R | Relative humidity | 0.1 %; default 765 = 76.5 % | 765 |
| `0x0122` (290) | R | Fan 1 output | 0.1 % | — |
| `0x0123` (291) | R | Fan 2 output | 0.1 % | — |

The previous YAML sensor definitions had the right addresses for the basic
hours, RPM and temperature measurements, but decoded the two-register hours
counter in the wrong order. The PDF explicitly specifies **LSB first** and
gives `0x6E00 = 110 hours`; the integration now follows that example. The PDF
does not specify signed temperature registers, so temperature values are not
interpreted as signed. The additional read-only measurements and binary
input/output/alarm states are also exposed as entities.
