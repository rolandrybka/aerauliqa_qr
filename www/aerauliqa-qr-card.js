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
    return this.exploded ? 8 : 6;
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

  renderIcon(name, className = "label-icon") {
    const paths = {
      power: '<path d="M12 2v10"/><path d="M5.2 5.2a9 9 0 1 0 13.6 0"/>',
      fan: '<path d="M12 12c-1-2 0-8 3-8 2 0 2 3 0 5-1 1-2 2-3 3Z"/><path d="M12 12c2-1 8 0 8 3 0 2-3 2-5 0-1-1-2-2-3-3Z"/><path d="M12 12c1 2 0 8-3 8-2 0-2-3 0-5 1-1 2-2 3-3Z"/><path d="M12 12c-2 1-8 0-8-3 0-2 3-2 5 0 1 1 2 2 3 3Z"/>',
      mode: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    };

    return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
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

  renderExplodedFan(key, label, x, y, active) {
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
      <g class="exploded-fan">
        <circle cx="${x}" cy="${y}" r="22" class="fan-ring"/>
        <g class="${spinning ? "fan-blades spinning" : "fan-blades"}" style="--spin-duration: ${duration}s">
          <path d="M${x} ${y} C${x - 3} ${y - 13}, ${x + 2} ${y - 16}, ${x + 6} ${y - 14} C${x + 10} ${y - 11}, ${x + 5} ${y - 3}, ${x} ${y}Z"/>
          <path d="M${x} ${y} C${x + 13} ${y - 3}, ${x + 16} ${y + 2}, ${x + 14} ${y + 6} C${x + 11} ${y + 10}, ${x + 3} ${y + 5}, ${x} ${y}Z"/>
          <path d="M${x} ${y} C${x + 3} ${y + 13}, ${x - 2} ${y + 16}, ${x - 6} ${y + 14} C${x - 10} ${y + 11}, ${x - 5} ${y + 3}, ${x} ${y}Z"/>
          <path d="M${x} ${y} C${x - 13} ${y + 3}, ${x - 16} ${y - 2}, ${x - 14} ${y - 6} C${x - 11} ${y - 10}, ${x - 3} ${y - 5}, ${x} ${y}Z"/>
          <circle cx="${x}" cy="${y}" r="4" class="fan-hub"/>
        </g>
      </g>`;
  }

  renderExplodedFanReadout(key, label) {
    const fan = this.config.fans?.[key] || {};
    const output = this.sensorValue(fan.output, "%");
    const rpm = this.sensorValue(fan.rpm, "rpm");

    return `
      <div class="fan-readout">
        ${this.renderIcon("fan", "readout-icon")}
        <div>
          <span>${this.escape(label)}</span>
          <strong>${this.escape(output.value)}${this.escape(output.unit)}</strong>
          <small>${this.escape(rpm.value)} ${this.escape(rpm.unit)}</small>
        </div>
      </div>`;
  }

  renderExploded() {
    if (!this.shadowRoot || !this.config) {
      return;
    }

    this._svgId = this._svgId || `aerauliqa-${Math.random().toString(36).slice(2)}`;
    const svgId = this._svgId;
    const power = this.entityState(this.config.power_entity);
    const running = power?.state === "on";
    const stale = power?.attributes?.modbus_stale === true;
    const flowing = running && !stale;
    const temperatures = this.config.temperatures || {};
    const filter = this.sensorValue(
      this.config.filter_entity,
      "d"
    );
    const filterDays = Number(filter.value);
    const filterColor = !Number.isFinite(filterDays)
      ? "var(--secondary-text-color)"
      : filterDays < 5
        ? "#f05b61"
        : filterDays <= 15
          ? "#f0a43b"
          : "#37c982";
    const filterMessage = Number.isFinite(filterDays)
      ? `${this.escape(filter.value)} ${this.escape(filter.unit || "d")} left`
      : "Unavailable";
    const t11 = this.sensorValue(temperatures.T11, "°C");
    const t12 = this.sensorValue(temperatures.T12, "°C");
    const t21 = this.sensorValue(temperatures.T21, "°C");
    const t22 = this.sensorValue(temperatures.T22, "°C");
    const error = this._error
      ? `<p class="error">${this.escape(this._error)}</p>`
      : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --aerauliqa-panel-background: rgba(77, 163, 223, 0.14);
          --fresh-air: #55d9ff;
          --exhaust-air: #ff806f;
          --wire: rgba(124, 220, 255, 0.72);
        }
        ha-card {
          overflow: hidden;
          color: var(--primary-text-color);
          border: 1px solid rgba(83, 196, 255, .32);
          border-radius: 24px;
          background:
            radial-gradient(ellipse at 50% 34%, rgba(13, 109, 158, .2), transparent 52%),
            radial-gradient(ellipse at 4% 0%, rgba(40, 135, 205, .18), transparent 38%),
            linear-gradient(145deg, #0b1c32, #071326 72%, #091a2c);
          box-shadow: var(--ha-card-box-shadow, 0 8px 30px #0006), 0 0 22px rgba(49, 187, 255, .08);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 22px 10px;
        }
        .title { font-size: 19px; font-weight: 700; letter-spacing: .01em; }
        .subtitle { color: var(--secondary-text-color); font-size: 12px; margin-top: 4px; }
        .status {
          border-radius: 999px;
          padding: 6px 11px;
          background: ${stale ? "#e6a23c30" : running ? "#27ae6030" : "#7f8c8d24"};
          color: ${stale ? "#e6a23c" : running ? "#3aba70" : "var(--secondary-text-color)"};
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .06em;
        }
        .filter-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          max-width: calc(100% - 40px);
          margin: 4px 20px 0 auto;
          padding: 8px 12px;
          border: 1px solid color-mix(in srgb, ${filterColor} 45%, transparent);
          border-radius: 999px;
          background: color-mix(in srgb, ${filterColor} 13%, transparent);
          color: ${filterColor};
          font-size: 12px;
          font-weight: 700;
        }
        .filter-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: ${filterColor};
          box-shadow: 0 0 12px ${filterColor};
        }
        .filter-caption { opacity: .8; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
        .exploded-stage {
          position: relative;
          margin: 0 10px;
          padding: 4px 0 0;
          overflow: hidden;
          background:
            radial-gradient(ellipse at 52% 55%, rgba(33, 161, 218, .12), transparent 54%),
            linear-gradient(rgba(67, 181, 232, .025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(67, 181, 232, .025) 1px, transparent 1px);
          background-size: auto, 18px 18px, 18px 18px;
        }
        .exploded-stage svg { display: block; width: 100%; height: auto; overflow: visible; }
        .device-top, .device-side, .device-front {
          stroke: var(--wire);
          stroke-width: 1.35;
          stroke-linejoin: round;
          filter: url(#${svgId}-glow);
        }
        .device-top { fill: rgba(55, 188, 239, .075); }
        .device-side { fill: rgba(38, 148, 206, .14); }
        .device-front { fill: rgba(16, 51, 79, .46); }
        .wire { fill: none; stroke: var(--wire); stroke-width: 1.15; filter: url(#${svgId}-glow); }
        .core { fill: rgba(73, 195, 234, .11); stroke: rgba(140, 230, 255, .86); stroke-width: 1.2; filter: url(#${svgId}-glow); }
        .core-rib { stroke: rgba(129, 224, 255, .66); stroke-width: 1; }
        .matrix-overlay { fill: url(#${svgId}-matrix-grid); opacity: .38; }
        .matrix-trace { fill: none; stroke: rgba(110, 221, 255, .22); stroke-width: .8; }
        .pipe-fresh, .pipe-exhaust {
          fill: none;
          stroke-width: 11;
          stroke-linecap: round;
          stroke-linejoin: round;
          opacity: .78;
          filter: url(#${svgId}-glow);
        }
        .pipe-fresh { stroke: url(#${svgId}-fresh-pipe); }
        .pipe-exhaust { stroke: url(#${svgId}-exhaust-pipe); }
        .pipe-glow {
          fill: none;
          stroke-width: 2;
          stroke-dasharray: 2 13;
          stroke-linecap: round;
          filter: url(#${svgId}-glow);
        }
        .pipe-glow.fresh { stroke: #c3ecff; }
        .pipe-glow.exhaust { stroke: #ffd1c9; }
        .air-moving { animation: pipe-flow 1.7s linear infinite; }
        @keyframes pipe-flow { to { stroke-dashoffset: -30; } }
        .port { fill: var(--ha-card-background, var(--card-background-color)); stroke-width: 2; }
        .port.fresh { stroke: var(--fresh-air); }
        .port.exhaust { stroke: var(--exhaust-air); }
        .svg-caption { fill: var(--secondary-text-color); font-size: 10px; font-weight: 700; letter-spacing: .08em; }
        .svg-temp { fill: var(--primary-text-color); font-size: 13px; font-weight: 750; }
        .svg-temp.fresh { fill: var(--fresh-air); }
        .svg-temp.exhaust { fill: var(--exhaust-air); }
        .filter-element { fill: ${filterColor}; opacity: .88; filter: drop-shadow(0 0 5px ${filterColor}); }
        .filter-wire { stroke: rgba(255,255,255,.65); stroke-width: 1; }
        .fan-ring { fill: rgba(16, 34, 52, .65); stroke: var(--wire); stroke-width: 1.5; }
        .fan-blades { fill: #bc73ed; filter: drop-shadow(0 0 4px rgba(189, 110, 255, .65)); }
        .fan-blades.spinning {
          transform-box: fill-box;
          transform-origin: center;
          animation: fan-spin var(--spin-duration, 2s) linear infinite;
        }
        .fan-hub { fill: #d8ebf8; }
        @keyframes fan-spin { to { transform: rotate(360deg); } }
        .fan-readouts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          padding: 0 18px 14px;
        }
        .fan-readout {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          padding: 10px 12px;
          border: 1px solid var(--divider-color);
          border-radius: 14px;
          background: var(--aerauliqa-panel-background);
        }
        .readout-icon { flex: 0 0 24px; width: 24px; height: 24px; color: #b76bd2; }
        .fan-readout div { display: grid; gap: 2px; min-width: 0; }
        .fan-readout span { color: var(--secondary-text-color); font-size: 10px; }
        .fan-readout strong { font-size: 16px; line-height: 1.1; }
        .fan-readout small { color: var(--secondary-text-color); font-size: 10px; }
        .legend {
          display: flex;
          justify-content: center;
          gap: 20px;
          padding: 0 12px 12px;
          color: var(--secondary-text-color);
          font-size: 10px;
        }
        .legend span { display: inline-flex; align-items: center; gap: 6px; }
        .legend i { width: 8px; height: 8px; border-radius: 50%; }
        .legend .fresh-dot { background: var(--fresh-air); }
        .legend .exhaust-dot { background: var(--exhaust-air); }
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
        .control-heading { display: flex; align-items: center; gap: 8px; }
        .label-icon { flex: 0 0 19px; width: 19px; height: 19px; color: #b76bd2; }
        select {
          width: 100%; padding: 0; border: 0; outline: 0;
          color: var(--primary-text-color); background: transparent;
          font: inherit; font-size: 14px;
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
          background: var(--aerauliqa-panel-background);
          font: inherit;
          cursor: pointer;
        }
        .power:disabled { opacity: .55; cursor: default; }
        .power-label { display: inline-flex; align-items: center; gap: 9px; font-size: 14px; font-weight: 600; }
        .power-icon { width: 23px; height: 23px; color: #b76bd2; }
        .toggle {
          min-width: 62px; padding: 8px 12px; border-radius: 999px;
          color: white; background: ${running ? "#28a96b" : "#69747d"};
          font-size: 12px; font-weight: 700; text-align: center;
        }
        .error { margin: 0; padding: 0 20px 16px; color: var(--error-color); }
        @media (max-width: 460px) {
          .header { padding: 18px 17px 9px; }
          .exploded-stage { margin: 0 4px; }
          .controls { grid-template-columns: 1fr; }
          .power { grid-column: auto; }
          .legend { gap: 12px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .air-moving, .fan-blades.spinning { animation: none; }
        }
      </style>
      <ha-card class="exploded-card">
        <div class="header">
          <div>
            <div class="title">${this.escape(this.config.name)}</div>
            <div class="subtitle">3D heat recovery unit · airflow view</div>
          </div>
          <span class="status">${
            stale
              ? "STALE DATA"
              : power
                ? running
                  ? "RUNNING"
                  : "OFF"
                : "UNAVAILABLE"
          }</span>
        </div>
        <div class="filter-chip">
          <span class="filter-dot"></span>
          <span class="filter-caption">Filter</span>
          <span>${filterMessage}</span>
        </div>
        <div class="exploded-stage">
          <svg viewBox="0 0 600 370" role="img" aria-label="Perspective wireframe view of the heat recovery ventilation unit">
            <defs>
              <filter id="${svgId}-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="1.8" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <pattern id="${svgId}-matrix-grid" width="12" height="12" patternUnits="userSpaceOnUse">
                <path d="M12 0H0V12" fill="none" stroke="#62d8ff" stroke-opacity=".38" stroke-width=".55"/>
                <circle cx="2" cy="2" r=".7" fill="#a5f0ff" fill-opacity=".72"/>
              </pattern>
              <clipPath id="${svgId}-front-panel-clip">
                <polygon points="164,96 418,96 418,270 164,270"/>
              </clipPath>
              <linearGradient id="${svgId}-fresh-pipe" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0" stop-color="#56a8ff"/>
                <stop offset="1" stop-color="#53d3df"/>
              </linearGradient>
              <linearGradient id="${svgId}-exhaust-pipe" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0" stop-color="#ffb05b"/>
                <stop offset="1" stop-color="#fa6571"/>
              </linearGradient>
            </defs>
            <g opacity=".7">
              <path class="pipe-fresh" stroke="url(#${svgId}-fresh-pipe)" d="M552 112 H472 L424 145 H354 L300 205 H170 L105 247 H43"/>
              <path class="pipe-exhaust" stroke="url(#${svgId}-exhaust-pipe)" d="M43 112 H105 L170 154 H245 L300 205 H365 L424 247 H472 L552 247"/>
              <path class="pipe-glow fresh ${flowing ? "air-moving" : ""}" d="M552 112 H472 L424 145 H354 L300 205 H170 L105 247 H43"/>
              <path class="pipe-glow exhaust ${flowing ? "air-moving" : ""}" d="M43 112 H105 L170 154 H245 L300 205 H365 L424 247 H472 L552 247"/>
            </g>

            <polygon class="device-top" points="164,96 225,52 478,52 418,96"/>
            <polygon class="device-side" points="418,96 478,52 478,224 418,270"/>
            <polygon class="device-front" points="164,96 418,96 418,270 164,270"/>
            <rect class="matrix-overlay" x="164" y="96" width="254" height="174" clip-path="url(#${svgId}-front-panel-clip)"/>
            <path class="matrix-trace" d="M178 108H210V119H222M363 108H400V129H389M177 239H211V250H241M371 250H402V232"/>
            <path class="wire" d="M164 96V270M164 270L225 224H478M418 96V270M225 52V224M225 224L164 270M225 52L225 224M225 52H478V224"/>
            <path class="wire" d="M184 112H398V251H184ZM199 112V251M383 112V251"/>
            <path class="wire" d="M164 103H418M171 96L232 52M411 96L471 52M172 263L231 218M411 263L471 218"/>
            <path class="matrix-trace" d="M211 116V134M215 116V134M219 116V134M376 116V134M380 116V134M384 116V134"/>
            <circle cx="174" cy="106" r="2" fill="#b4f2ff"/>
            <circle cx="408" cy="106" r="2" fill="#b4f2ff"/>
            <circle cx="174" cy="260" r="2" fill="#b4f2ff"/>
            <circle cx="408" cy="260" r="2" fill="#b4f2ff"/>

            <g>
              <polygon class="core" points="263,132 343,122 343,214 263,224"/>
              <path class="core-rib" d="M273 136V220M287 134V218M301 132V216M315 130V214M329 128V212"/>
            </g>

            <g>
              <path class="wire" d="M164 119H184M164 250H184M398 119H418M398 250H418"/>
              <rect class="filter-element" x="186" y="115" width="8" height="22" rx="2"/>
              <path class="filter-wire" d="M188 117V135M191 117V135"/>
              <rect class="filter-element" x="388" y="115" width="8" height="22" rx="2"/>
              <path class="filter-wire" d="M390 117V135M393 117V135"/>
            </g>

            <g>
              <circle class="port fresh" cx="44" cy="112" r="8"/>
              <circle class="port fresh" cx="44" cy="247" r="8"/>
              <circle class="port exhaust" cx="551" cy="112" r="8"/>
              <circle class="port exhaust" cx="551" cy="247" r="8"/>
              <text class="svg-caption" x="20" y="82">EXHAUST</text>
              <text class="svg-temp exhaust" x="20" y="100">${this.escape(t22.value)}${this.escape(t22.unit)}</text>
              <text class="svg-caption" x="20" y="278">SUPPLY</text>
              <text class="svg-temp fresh" x="20" y="296">${this.escape(t12.value)}${this.escape(t12.unit)}</text>
              <text class="svg-caption" x="580" y="82" text-anchor="end">FRESH IN</text>
              <text class="svg-temp fresh" x="580" y="100" text-anchor="end">${this.escape(t11.value)}${this.escape(t11.unit)}</text>
              <text class="svg-caption" x="580" y="278" text-anchor="end">EXHAUST</text>
              <text class="svg-temp exhaust" x="580" y="296" text-anchor="end">${this.escape(t21.value)}${this.escape(t21.unit)}</text>
            </g>

            ${this.renderExplodedFan("fan_1", "Supply fan", 218, 204, flowing)}
            ${this.renderExplodedFan("fan_2", "Extract fan", 364, 204, flowing)}
            <text class="svg-caption" x="291" y="318" text-anchor="middle">COUNTERFLOW HEAT EXCHANGER</text>
            <text class="svg-caption" x="205" y="74">FILTER</text>
            <text class="svg-caption" x="378" y="74">FILTER</text>
            <path class="wire" d="M211 78L190 111M384 78L392 111"/>
          </svg>
        </div>
        <div class="fan-readouts">
          ${this.renderExplodedFanReadout("fan_1", "Supply fan")}
          ${this.renderExplodedFanReadout("fan_2", "Extract fan")}
        </div>
        <div class="legend">
          <span><i class="fresh-dot"></i>Fresh / supply air</span>
          <span><i class="exhaust-dot"></i>Extract / exhaust air</span>
        </div>
        <div class="controls">
          <button class="power" type="button" ${power ? "" : "disabled"}>
            <span class="power-label">${this.renderIcon("power", "power-icon")}Ventilation</span>
            <span class="toggle">${running ? "ON" : "OFF"}</span>
          </button>
          ${this.renderSelect(this.config.fan_speed_entity, "Fan speed", "fan")}
          ${this.renderSelect(this.config.working_mode_entity, "Working mode", "mode")}
        </div>
        ${error}
      </ha-card>`;

    this.bindControlHandlers(running);
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
        <span class="control-heading">${this.renderIcon(icon)}${this.escape(label)}</span>
        <select data-entity="${this.escape(entityId)}">${optionMarkup}</select>
      </label>`;
  }

  render() {
    if (!this.shadowRoot || !this.config) {
      return;
    }
    if (this.exploded) {
      this.renderExploded();
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
        :host {
          display: block;
          --aerauliqa-panel-background: rgba(77, 163, 223, 0.14);
        }
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
          background: var(--aerauliqa-panel-background);
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
          background: var(--aerauliqa-panel-background);
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
          background: var(--aerauliqa-panel-background);
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
        .control-heading {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .label-icon {
          flex: 0 0 19px;
          width: 19px;
          height: 19px;
          color: var(--info-color, #4da3df);
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
          background: var(--aerauliqa-panel-background);
          font: inherit;
          cursor: pointer;
        }
        .power-label {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          font-size: 14px;
          font-weight: 600;
        }
        .power-icon {
          width: 23px;
          height: 23px;
          color: var(--info-color, #4da3df);
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
            <span class="power-label">${this.renderIcon("power", "power-icon")}Ventilation</span>
            <span class="toggle">${running ? "ON" : "OFF"}</span>
          </button>
          ${this.renderSelect(
            this.config.fan_speed_entity,
            "Fan speed",
            "fan"
          )}
          ${this.renderSelect(
            this.config.working_mode_entity,
            "Working mode",
            "mode"
          )}
        </div>
        ${error}
      </ha-card>`;

    this.bindControlHandlers(running);
  }

  bindControlHandlers(running) {
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

class AerauliqaQRExplodedCard extends AerauliqaQRCard {
  constructor() {
    super();
    this.exploded = true;
  }

  setConfig(config) {
    if (!config.filter_entity) {
      throw new Error(
        "Set filter_entity for the exploded card (for example sensor.aerauliqa_qr_filter_countdown)."
      );
    }
    super.setConfig(config);
  }
}

customElements.define("aerauliqa-qr-exploded-card", AerauliqaQRExplodedCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "aerauliqa-qr-card",
  name: "Aerauliqa QR",
  description: "Classic heat recovery airflow and temperature overview",
});
window.customCards.push({
  type: "aerauliqa-qr-exploded-card",
  name: "Aerauliqa QR Exploded",
  description: "Perspective wireframe heat recovery unit visualization",
});
