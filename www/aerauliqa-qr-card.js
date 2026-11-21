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
    return 4;
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
    return this.hass?.states?.[entityId];
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
    const temperatures = Object.entries(this.config.temperatures || {})
      .map(([label, entityId]) => {
        const entity = this.entityState(entityId);
        const value = entity
          ? `${this.escape(entity.state)}${this.escape(
              entity.attributes.unit_of_measurement || "°C"
            )}`
          : "—";
        return `
          <div class="temperature">
            <span>${this.escape(label)}</span>
            <strong>${value}</strong>
          </div>`;
      })
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
          border-radius: 20px;
          background:
            radial-gradient(ellipse at 100% 0%, #42b6a433, transparent 48%),
            var(--ha-card-background, var(--card-background-color));
          box-shadow: var(--ha-card-box-shadow, 0 4px 18px #0002);
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
          background: ${
            stale ? "#e6a23c30" : running ? "#27ae6030" : "#7f8c8d24"
          };
          color: ${
            stale ? "#e6a23c" : running ? "#3aba70" : "var(--secondary-text-color)"
          };
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .temperatures {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          padding: 6px 18px 16px;
        }
        .temperature {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
          padding: 14px;
          border-radius: 14px;
          background: var(--secondary-background-color, #8881);
        }
        .temperature span { color: var(--secondary-text-color); font-size: 12px; }
        .temperature strong { font-size: 23px; font-weight: 600; }
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
        @media (max-width: 360px) {
          .temperatures, .controls { grid-template-columns: 1fr; }
          .power { grid-column: auto; }
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
        ${
          temperatures
            ? `<div class="temperatures">${temperatures}</div>`
            : ""
        }
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
  description: "Ventilation controls and temperature overview",
});
