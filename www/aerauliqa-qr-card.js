class AerauliqaQRCard extends HTMLElement {
  setConfig(config) {
    if (!config.power_entity || !config.fan_speed_entity || !config.working_mode_entity) {
      throw new Error(
        "Set power_entity, fan_speed_entity and working_mode_entity."
      );
    }

    this.config = {
      name: "Aerauliqa QR",
      temperatures: {},
      fans: {},
      air_paths: [
        {
          name: "Supply air",
          from: "T11",
          to: "T12",
          direction: "forward",
        },
        {
          name: "Extract air",
          from: "T21",
          to: "T22",
          direction: "reverse",
        },
      ],
      ...config,
    };
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 6;
  }

  escape(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  entityState(entityId) {
    return entityId ? this.hass?.states?.[entityId] : undefined;
  }

  sensorValue(entityId, fallbackUnit = "") {
    const entity = this.entityState(entityId);
    if (!entity || ["unknown", "unavailable"].includes(entity.state)) {
      return { value: "—", unit: "" };
    }

    const numericValue = Number(entity.state);
    const value = Number.isFinite(numericValue)
      ? Number.isInteger(numericValue)
        ? String(numericValue)
        : numericValue.toFixed(1)
      : entity.state;
    return {
      value,
      unit: entity.attributes.unit_of_measurement || fallbackUnit,
    };
  }

  renderTemperature(label, entityId) {
    const { value, unit } = this.sensorValue(entityId, "°C");
    const numericValue = Number(value);
    const hue = Number.isFinite(numericValue)
      ? Math.max(0, Math.min(220, 220 - numericValue * 5.5))
      : 36;

    return `
      <div class="temperature">
        <span class="temperature-label">${this.escape(label)}</span>
        <strong style="--temperature-hue: ${hue}">${this.escape(value)}${this.escape(unit)}</strong>
      </div>`;
  }

  renderAirPath(path, flowing) {
    const temperatures = this.config.temperatures || {};
    const reverse = path.direction === "reverse";
    const flowClass = flowing ? "flow-line active" : "flow-line";

    return `
      <div class="air-path ${reverse ? "reverse" : ""}">
        <div class="path-name">${this.escape(path.name)}</div>
        ${this.renderTemperature(path.from, temperatures[path.from])}
        <div class="${flowClass}" aria-hidden="true"><span></span></div>
        <div class="exchanger" aria-label="Heat exchanger">
          <span class="exchanger-mark">✣</span>
          <small>HR</small>
        </div>
        <div class="${flowClass}" aria-hidden="true"><span></span></div>
        ${this.renderTemperature(path.to, temperatures[path.to])}
      </div>`;
  }

  renderFan(key, label, active) {
    const fan = this.config.fans?.[key] || {};
    const output = this.sensorValue(fan.output, "%");
    const rpm = this.sensorValue(fan.rpm, "rpm");
    const outputValue = Number(output.value);
    const outputPercent = Number.isFinite(outputValue)
      ? Math.max(0, Math.min(100, outputValue))
      : 0;
    const spinning = active && outputPercent > 0;
    const duration = (5 - outputPercent * 0.045).toFixed(2);

    return `
      <div class="fan">
        <div class="rotor ${spinning ? "spinning" : ""}" style="--spin-duration: ${duration}s" aria-hidden="true">
          <i></i><i></i><i></i><i></i>
          <b></b>
        </div>
        <div class="fan-data">
          <span class="fan-name">${this.escape(label)}</span>
          <strong>${this.escape(output.value)}${this.escape(output.unit)}</strong>
          <small>${this.escape(rpm.value)} ${this.escape(rpm.unit)}</small>
        </div>
      </div>`;
  }

  renderSelect(entityId, label, icon) {
    const entity = this.entityState(entityId);
    if (!entity) {
      return `<div class="control"><span>${icon} ${label}</span><small>Entity unavailable</small></div>`;
    }

    const options = entity.attributes.options || [];
    const optionMarkup = options
      .map(
        (option) =>
          `<option value="${this.escape(option)}" ${
            option === entity.state ? "selected" : ""
          }>${this.escape(option)}</option>`
      )
      .join("");

    return `
      <label class="control">
        <span>${icon} ${label}</span>
        <select data-entity="${this.escape(entityId)}">${optionMarkup}</select>
      </label>`;
  }

  render() {
    if (!this.shadowRoot || !this.config) {
      return;
    }

    const power = this.entityState(this.config.power_entity);
    const running = power?.state === "on";
    const stale = power?.attributes?.modbus_stale === true;
    const flowing = running && !stale;
    const paths = this.config.air_paths || [];
    const airPaths = paths
      .map((path) => this.renderAirPath(path, flowing))
      .join("");
    const error = this._error
      ? `<p class="error">${this.escape(this._error)}</p>`
      : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          overflow: hidden;
          color: var(--primary-text-color);
          border-radius: 22px;
          background:
            radial-gradient(ellipse at 4% 0%, #54a9ff20, transparent 38%),
            radial-gradient(ellipse at 100% 0%, #42b6a433, transparent 45%),
            var(--ha-card-background, var(--card-background-color));
          box-shadow: var(--ha-card-box-shadow, 0 5px 22px #0002);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 22px 14px;
        }
        .title { font-size: 19px; font-weight: 650; letter-spacing: .01em; }
        .subtitle { color: var(--secondary-text-color); font-size: 12px; margin-top: 4px; }
        .status {
          border-radius: 999px;
          padding: 6px 11px;
          background: ${stale ? "#e6a23c30" : running ? "#27ae6030" : "#7f8c8d24"};
          color: ${stale ? "#e6a23c" : running ? "#3aba70" : "var(--secondary-text-color)"};
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .section-title {
          padding: 4px 20px 10px;
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .airflow {
          display: grid;
          gap: 10px;
          padding: 0 18px 18px;
        }
        .air-path {
          display: grid;
          grid-template-columns: minmax(65px, 1fr) minmax(20px, .5fr) 62px minmax(20px, .5fr) minmax(65px, 1fr);
          align-items: center;
          gap: 8px;
          min-width: 0;
          padding: 11px;
          border-radius: 16px;
          background: var(--secondary-background-color, #8881);
        }
        .path-name {
          grid-column: 1 / -1;
          direction: ltr;
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 650;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .temperature {
          direction: ltr;
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
          padding: 8px;
          border-radius: 11px;
          background: var(--ha-card-background, var(--card-background-color));
          text-align: center;
        }
        .temperature-label { color: var(--secondary-text-color); font-size: 11px; }
        .temperature strong {
          color: hsl(var(--temperature-hue, 36) 78% 55%);
          font-size: clamp(14px, 4vw, 19px);
          font-weight: 700;
          white-space: nowrap;
        }
        .exchanger {
          direction: ltr;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          margin: auto;
          border: 1px solid var(--divider-color);
          border-radius: 13px;
          background:
            linear-gradient(135deg, #ed795533 0 48%, transparent 49% 51%, #45a8e533 52%),
            var(--ha-card-background, var(--card-background-color));
        }
        .exchanger-mark { font-size: 25px; line-height: 25px; }
        .exchanger small { color: var(--secondary-text-color); font-size: 9px; font-weight: 700; }
        .flow-line {
          position: relative;
          height: 3px;
          border-radius: 3px;
          background: var(--divider-color);
        }
        .flow-line::after {
          position: absolute;
          top: -4px;
          right: -1px;
          width: 0;
          height: 0;
          border-top: 5px solid transparent;
          border-bottom: 5px solid transparent;
          border-left: 7px solid var(--secondary-text-color);
          content: "";
        }
        .reverse { direction: rtl; }
        .reverse .flow-line::after {
          right: auto;
          left: -1px;
          border-right: 7px solid var(--secondary-text-color);
          border-left: 0;
        }
        .flow-line span {
          position: absolute;
          top: -2px;
          left: 0;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--info-color, #4da3df);
          opacity: 0;
        }
        .flow-line.active span { opacity: 1; animation: airflow 1.8s linear infinite; }
        .reverse .flow-line.active span { animation-direction: reverse; }
        @keyframes airflow {
          from { transform: translateX(0); }
          to { transform: translateX(calc(100% - 7px)); }
        }
        .fans {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          padding: 0 18px 18px;
        }
        .fan {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
          padding: 13px;
          border: 1px solid var(--divider-color);
          border-radius: 16px;
          background: var(--secondary-background-color, #8881);
        }
        .rotor {
          position: relative;
          flex: 0 0 48px;
          width: 48px;
          height: 48px;
          border: 2px solid var(--divider-color);
          border-radius: 50%;
          background: radial-gradient(circle, transparent 0 54%, #4da3df20 55%);
        }
        .rotor.spinning { animation: spin var(--spin-duration, 2s) linear infinite; }
        .rotor i {
          position: absolute;
          top: 5px;
          left: 20px;
          width: 8px;
          height: 17px;
          border-radius: 80% 20% 65% 35%;
          background: var(--info-color, #4da3df);
          transform-origin: 4px 19px;
        }
        .rotor i:nth-child(2) { transform: rotate(90deg); }
        .rotor i:nth-child(3) { transform: rotate(180deg); }
        .rotor i:nth-child(4) { transform: rotate(270deg); }
        .rotor b {
          position: absolute;
          top: 19px;
          left: 19px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--primary-text-color);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fan-data { display: flex; flex-direction: column; min-width: 0; gap: 3px; }
        .fan-name { color: var(--secondary-text-color); font-size: 11px; }
        .fan-data strong { font-size: 19px; line-height: 1.1; }
        .fan-data small { color: var(--secondary-text-color); font-size: 11px; }
        .controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          padding: 0 18px 20px;
        }
        .control {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
          min-width: 0;
          padding: 12px 14px;
          border: 1px solid var(--divider-color);
          border-radius: 14px;
          color: var(--secondary-text-color);
          font-size: 12px;
        }
        select {
          width: 100%;
          padding: 0;
          border: 0;
          outline: 0;
          color: var(--primary-text-color);
          background: transparent;
          font: inherit;
          font-size: 14px;
        }
        .power {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 15px;
          border: 0;
          border-radius: 14px;
          color: var(--primary-text-color);
          background: var(--secondary-background-color, #8881);
          font: inherit;
          cursor: pointer;
        }
        .power:disabled { opacity: .55; cursor: default; }
        .toggle {
          min-width: 62px;
          padding: 8px 12px;
          border-radius: 999px;
          color: white;
          background: ${running ? "#28a96b" : "#69747d"};
          font-size: 12px;
          font-weight: 700;
          text-align: center;
        }
        .error { margin: 0; padding: 0 20px 16px; color: var(--error-color); }
        @media (max-width: 460px) {
          .air-path {
            grid-template-columns: minmax(48px, .7fr) minmax(18px, .4fr) 48px minmax(18px, .4fr) minmax(48px, .7fr);
            gap: 5px;
            padding: 9px;
          }
          .path-name { grid-column: 1 / -1; }
          .air-path .temperature { padding: 6px 3px; }
          .exchanger { width: 44px; height: 44px; }
          .fans { grid-template-columns: 1fr; }
          .controls { grid-template-columns: 1fr; }
          .power { grid-column: auto; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rotor.spinning, .flow-line.active span { animation: none; }
        }
      </style>
      <ha-card>
        <div class="header">
          <div>
            <div class="title">${this.escape(this.config.name)}</div>
            <div class="subtitle">Heat recovery ventilation</div>
          </div>
          <span class="status">${
            stale
              ? "Stale data"
              : power
                ? running
                  ? "Running"
                  : "Off"
                : "Unavailable"
          }</span>
        </div>
        <div class="section-title">Airflow &amp; temperatures</div>
        <div class="airflow">${airPaths}</div>
        <div class="section-title">Fans</div>
        <div class="fans">
          ${this.renderFan("fan_1", "Fan 1", flowing)}
          ${this.renderFan("fan_2", "Fan 2", flowing)}
        </div>
        <div class="controls">
          <button class="power" type="button" ${power ? "" : "disabled"}>
            <span>⏻ &nbsp; Ventilation</span>
            <span class="toggle">${running ? "ON" : "OFF"}</span>
          </button>
          ${this.renderSelect(
            this.config.fan_speed_entity,
            "Fan speed",
            "↗"
          )}
          ${this.renderSelect(
            this.config.working_mode_entity,
            "Working mode",
            "◉"
          )}
        </div>
        ${error}
      </ha-card>`;

    this.shadowRoot.querySelector(".power")?.addEventListener("click", () => {
      this.callService("switch", running ? "turn_off" : "turn_on", {
        entity_id: this.config.power_entity,
      });
    });

    this.shadowRoot.querySelectorAll("select[data-entity]").forEach((select) => {
      select.addEventListener("change", (event) => {
        this.callService("select", "select_option", {
          entity_id: event.currentTarget.dataset.entity,
          option: event.currentTarget.value,
        });
      });
    });
  }

  async callService(domain, service, data) {
    this._error = undefined;
    try {
      await this.hass.callService(domain, service, data);
    } catch (error) {
      this._error = error.message || "Could not control the ventilator.";
    }
    this.render();
  }
}

customElements.define("aerauliqa-qr-card", AerauliqaQRCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "aerauliqa-qr-card",
  name: "Aerauliqa QR",
  description: "Heat recovery airflow, fan and temperature overview",
});
