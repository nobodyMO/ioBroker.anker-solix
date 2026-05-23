# ioBroker.anker-solix

[![NPM version](https://img.shields.io/npm/v/iobroker.anker-solix.svg)](https://www.npmjs.com/package/iobroker.anker-solix)

ioBroker adapter for **Anker Solix** power systems (Solarbank, Smart Meter, PPS, EV charger, and more). It is based on the Home Assistant integration [thomluther/ha-anker-solix](https://github.com/thomluther/ha-anker-solix) and uses the same unofficial **solixapi** Python library.

A small **Python bridge** (persistent daemon, like HA) polls the Anker cloud and optional MQTT, then exposes values as ioBroker states. Optional entity groups (since v0.9.0) mirror HA’s scope: only **Core** is on by default to limit API load.

## Table of contents

1. [Disclaimer & usage terms](#disclaimer--usage-terms)
2. [How this adapter works in ioBroker](#how-this-adapter-works-in-iobroker)
3. [Requirements & installation](#requirements--installation)
4. [Configuration](#configuration)
5. [Anker account & login cache](#anker-account--login-cache)
6. [Limitations](#limitations)
7. [Supported devices](#supported-devices)
8. [State structure & entity groups](#state-structure--entity-groups)
9. [MQTT](#mqtt-managed-devices)
10. [Special device notes](#special-device-notes)
11. [Troubleshooting login / poll](#troubleshooting-login--poll)
12. [Services](#services)
13. [Credits & further reading](#credits--further-reading)
14. [Changelog](#changelog)
15. [Publishing](#publishing-npm--iobroker-catalog)

---

## Disclaimer & usage terms

This adapter is **not** affiliated with Anker. Trademarks and product names belong to their respective owners.

The adapter uses an **unofficial** Python library to talk to the Anker Power **cloud API** (same as the mobile app). That API can change or break at any time. Improper settings may affect devices; the user accepts these risks when enabling the instance (**Terms** tab). Future adapter updates may extend monitoring or controls.

---

## How this adapter works in ioBroker

| Layer | Role |
|-------|------|
| **Node.js adapter** | Instance config, scheduling, ioBroker states, control queue |
| **Python bridge** (`python/bridge.py`) | Long-lived session: API + optional MQTT (HA-style) |
| **solixapi** | Cloud login, sites/devices, energy stats, MQTT map |
| **authcache** | `iobroker-data/<instance>/authcache/<email>.json` — reused after successful API login |

Poll interval should be **60–180 s** (same recommendation as HA). Site list is updated every cycle; device/site details and energy data run on a slower interval (`deviceDetailMultiplier`, default every 10th poll).

> **Important:** The cloud API is **mandatory**. MQTT alone is not enough for full system data. This adapter does **not** replace local BLE or Modbus integrations — see [Additional resources](#credits--further-reading).

---

## Requirements & installation

- ioBroker **js-controller >= 6**, **admin >= 7.6**
- **Node.js >= 22**
- **Python 3.12+** on the ioBroker host (`python3-venv` + `python3-pip` recommended on Debian/Ubuntu)

Python dependencies install into the adapter folder (`python/.venv` or `python/site-packages`). Since v0.2.0: automatic on start (**Options** → `autoInstallPython`) or button **Install Python dependencies**.

Install via ioBroker (recommended):

```bash
iobroker install anker-solix
```

After changing the adapter files locally, upload the instance:

```bash
iobroker upload anker-solix
```

**Multihost:** use `--host "PC(SmartHome)"` with quotes if the name contains special characters.

Remove legacy symlink if present: `rm -f /opt/iobroker/node_modules/iobroker.AnkerSolix`

Manual Python setup (if needed):

```bash
cd node_modules/iobroker.anker-solix
python3 -m venv python/.venv && python/.venv/bin/pip install -r python/requirements.txt
```

---

## Configuration

1. Create instance: `iobroker add anker-solix`
2. **Account:** Anker e-mail, password, country code (e.g. `DE`) — **save after entering password**
3. **Terms:** accept unofficial API usage
4. **Options:** poll interval 60–180 s, **MQTT** if needed, `deviceDetailMultiplier` (HA default: 10)
5. **Devices:** **Load devices**, optional site ID / device SN filter
6. **Entities** (v0.9.0+): enable optional groups; only **Core** on by default → **restart adapter** after changes

Do **not** use **Clear Anker login cache** unless you need a deliberate re-login (wrong account, corrupted file). Clearing forces a new cloud login and often triggers captcha on server hosts — see [Troubleshooting](#troubleshooting-login--poll).

---

## Anker account & login cache

After the **first successful API login**, the adapter stores tokens in:

`iobroker-data/anker-solix.0/authcache/<your-email>.json`

(Filename must match the e-mail in **Account** exactly.)

Since Anker app **3.10** (mid-2025), one account can often be used on **multiple clients in parallel** (app + ioBroker + HA). Older docs about “only one token” are less critical today, but a **failed re-login** from ioBroker still cannot refresh the file if Anker returns captcha.

**Shared / member accounts:** A family-shared account may see fewer API details than the owner account (same as HA).

More account notes: [HA INFO.md – accounts](https://github.com/thomluther/ha-anker-solix/blob/main/INFO.md).

---

## Limitations

- **Unofficial API** — no documentation; endpoints can change anytime.
- **EU vs COM cloud** — wrong **country** in config → login works but **no systems/devices**. Do not switch countries after pairing devices.
- **Stale cloud data** if device Wi‑Fi is offline; use cloud/MQTT connection indicators when enabled.
- **MQTT** updates depend on device publish cycle; some values only with **real-time trigger** (high traffic if 24/7).
- **Standalone devices** (PPS, charger, cooler not in a power system) have **little or no API energy data** — MQTT may be required ([HA limitations](https://github.com/thomluther/ha-anker-solix#limitations)).
- **Dynamic tariff** beyond Nordpool: forecast/price entities may be wrong or read-only.
- **Captcha (100032)** on direct API login from VPS/VPN/datacenter — see [Troubleshooting](#troubleshooting-login--poll). Copy `authcache` from HA or another working setup if ioBroker cannot log in once.

To help add devices: export anonymized data via HA [export systems](https://github.com/thomluther/ha-anker-solix/blob/main/INFO.md#export-systems-action) or [anker-solix-api export_system.py](https://github.com/thomluther/anker-solix-api#export_systempy).

---

## Supported devices

Same device coverage as [ha-anker-solix](https://github.com/thomluther/ha-anker-solix#supported-sensors-and-devices) (via solixapi). In ioBroker, data appears under state IDs by device type (`solarbank`, `smartmeter`, `combiner_box`, `system`, …).

| Device type | Examples / notes |
|-------------|------------------|
| **system / site** | Power system from the Anker app (= API “site”) |
| **solarbank** | E1600 (Gen1), SB2 Pro/Plus/AC, SB3 E2700 — API + MQTT |
| **combiner_box** | Power Dock (multisystem) — merged controls in ioBroker when applicable |
| **smartmeter** | Anker 3-phase, US meter, Shelly 3EM / 3EM Pro |
| **inverter** | MI80 standalone (virtual site in API) |
| **smartplug** | Smart Plug 2500 W |
| **pps** / **solarbank_pps** | Portable power stations — mostly MQTT |
| **ev_charger** | V1 Smart EV Charger — mostly MQTT |
| **vehicle** | Virtual EVs for charger accounts — read-oriented in ioBroker |
| **powerpanel** / **hes** | US Power Panel, X1 HES — limited API, heavy stats polling |
| **charger** | Prime / charging stations — MQTT |
| **home_backup** | E10, AX170 — very limited API |

Device hierarchy (how HA structures entities): [discussion #239](https://github.com/thomluther/ha-anker-solix/discussions/239).

---

## State structure & entity groups

Typical paths (instance `anker-solix.0`):

- `anker-solix.0.solarbank.<deviceId>.sensors.*` — power, SOC, etc.
- `anker-solix.0.solarbank.<deviceId>.control.*` — writable controls where supported
- `anker-solix.0.<device>.<id>.statistics.*` — daily kWh (enable **Entities** → energy statistics)
- `anker-solix.0.smartmeter.<deviceId>.sensors.*`
- `anker-solix.0.services.*` — export, schedule, refresh (button states)
- `anker-solix.0.info.connection`, `anker-solix.0.info.pythonReady`

**Entity groups** (Admin → **Entities**): map to HA feature sets — power flows, diagnostics, PPS, EV charger, HES, site price, account info, etc. Disabled groups are excluded from API polls to reduce load.

---

## MQTT managed devices

Enable **MQTT** in **Options** when you need live data or controls that the cloud API does not provide (many PPS/EV/charger functions).

- Extra sensors/controls come from MQTT maps in solixapi (community-decoded per model).
- **Real-time trigger** and **status request** behave like HA buttons — automating them 24/7 increases traffic and keeps devices awake ([HA MQTT section](https://github.com/thomluther/ha-anker-solix#mqtt-managed-devices)).
- **Hybrid controls** (station SOC reserve, AC limits, grid export on multisystem) need MQTT + API like HA.
- Devices in **MQTT local mode** (e.g. E10 behind Power Dock) are proxied via the hub device — see [HA INFO – MQTT local mode](https://github.com/thomluther/ha-anker-solix/blob/main/INFO.md#devices-in-mqtt-local-mode).

Decoding new models: [MQTT guidelines](https://github.com/thomluther/anker-solix-api/discussions/222), tool `mqtt_monitor.py` in [anker-solix-api](https://github.com/thomluther/anker-solix-api).

---

## Special device notes

Condensed from the [HA integration README](https://github.com/thomluther/ha-anker-solix); behavior is the same via solixapi.

### Standalone inverters (MI80)

Not a full app “power system”, but cloud tracks yields. API creates a **virtual site**. Inverter Wi‑Fi state in API is often wrong; cloud connection state is more reliable. **Do not** change inverter limits permanently (hardware write cycles).

### Solarbank 1 (E1600)

Cloud updates ~every **60 s** while producing/discharging; ~hourly in standby. **Schedule bug:** a single all-day API slot can set export to **0 W** — use ≥2 slots in the app if using output preset. Daily discharge statistic since mid-2024 includes bypassed PV (also wrong in app). MQTT monitoring/control from HA v3.4+/3.5+.

### Solarbank 2 + smart meters

Cloud interval often **~5 minutes**; control changes may take up to **~6 minutes** to appear in sensors. Shared accounts historically had unavailable entities (Anker-side fix). Some **output limit** API paths still unknown.

### Solarbank 2 AC

Time-of-use plans via controls where supported; cloud updates can stall after heavy app use ([HA #211](https://github.com/thomluther/ha-anker-solix/issues/211)).

### Combined SB2 + cascaded SB1

Totals/statistics in Anker cloud reflect **SB2 only**; SB1 is partly a “black box”. Enforced minimal schedule on SB1 when SB2 is manual — some ioBroker/HA controls show **unavailable** intentionally. For correct charge/discharge energy, sum **per-device** battery power, not only system NET power ([HA details](https://github.com/thomluther/ha-anker-solix#combined-solarbank-2-systems-containing-cascaded-solarbank-1-devices)).

### Solarbank 3

Smart mode, dynamic price, time-slot modes — often **toggle only** via API (configure in app first). Dynamic price VAT/fees may be **cache-only** customizations. Nordpool forecast most reliable.

### Multisystem with Power Dock

Up to 4 SB3 units; shared station settings (usage mode, SOC reserve, grid export). Controls consolidated on **combiner / Power Dock** in integration logic. Cloud data can lag in early deployments. Multisystem **AC output limit** may not be changeable via API.

### Station controls

SOC reserve, PV/AC limits, grid export often need **API + MQTT** (hybrid). Third-party PV / EV-enable switches are usually one-time app setup — not exposed for automation.

### PPS / Solarbank PPS (F3000 + US meter)

Automation-style home backup in US; control mainly via MQTT.

### EV charger (V1)

Most metrics/controls via MQTT; member accounts supported. Operational modes map to HA-style state machine — in ioBroker, check available control options before scripts. Session history statistics not implemented (use state history).

### Vehicles

Virtual devices per account EV; no creation via adapter — discovered on refresh.

### Power Panel & HES (X1)

Limited API power; workaround uses **~5 min averages** from energy stats (**~80 MB/day** extra traffic per system if enabled). Disable heavy categories in **Entities** if needed. X1: consider local **Modbus** ([Anker spec](https://support.ankersolix.com/de/s/download-preview?urlname=Anker-SOLIX-X1-Series-Modbus-Protocol)) — not part of this adapter.

### Home Backup (E10, AX170)

Almost **no** cloud API for system energy; E10 often **MQTT local mode** via dock.

### Other / standalone devices

Only in a **power system** for full API; otherwise MQTT + community decoding required.

---

## Troubleshooting login / poll

### No `authcache/<email>.json`

The file is created only after a **successful** API login. If every login returns captcha, copy a working file from [ha-anker-solix](https://github.com/thomluther/ha-anker-solix) (`custom_components/anker_solix/solixapi/authcache/`) into `iobroker-data/anker-solix.0/authcache/`, same filename as in **Account**.

### `(100032) Captcha id empty`

Anker blocks some **server/VPN** API logins. The library cannot solve captcha.

1. Confirm app login on same LAN; correct **country**; no VPN on ioBroker host.
2. **Do not** clear login cache to “fix” captcha.
3. Copy `authcache` from HA or re-login when cloud allows.
4. Wait 15–30 min after many failed attempts.
5. Use adapter **≥ 0.9.3** so a valid cache is not discarded on restart.

Log shows exact cache path from **0.9.4+**.

### Rate limits (26161 / 429)

Increase poll interval; reduce enabled **Entities** groups; adapter retries and may fall back to one-shot bridge briefly.

---

## Services

States under `anker-solix.0.services.*` (set to `true` to trigger):

- `get_schedule`, `clear_schedule`, `export_systems`, `get_system_info`, `refresh_devices`

Uses `selectedDeviceId` / `selectedSiteId` from config. See Admin **Services** tab.

---

## Credits & further reading

| Resource | Content |
|----------|---------|
| [thomluther/ha-anker-solix](https://github.com/thomluther/ha-anker-solix) | Full README, **INFO.md** (config, MQTT, export, tariffs) |
| [thomluther/anker-solix-api](https://github.com/thomluther/anker-solix-api) | Python API, export, mqtt_monitor |
| [HA discussions](https://github.com/thomluther/ha-anker-solix/discussions) | Energy dashboard, zero export, efficiency |
| [SolixBLE](https://github.com/flip-dots/SolixBLE) | Local BLE (not cloud) |
| [ha-anker-solix-official](https://github.com/anker-charging/ha-anker-solix-official) | Official Modbus (local devices) |

German guides/videos linked from the [HA README](https://github.com/thomluther/ha-anker-solix#additional-resources) apply conceptually to data and limits; wiring is via ioBroker states instead of HA entities.

---

## Curtailment avoidance (optional)

Tab **Abregelungsvermeidung** / **Curtailment avoidance**: [solarprognose](https://github.com/ioBroker/ioBroker.solarprognose) detects overproduction days. **Controls only:** **manual** mode + **`ac_output_limit`** (AC output / export). **Does not** change station base settings (grid export cap, `allow_grid_export`, home load preset, AC charge limit). **Before:** `ac_output_limit` = live PV. **Active:** `missing_charge_wh`, `max_charge_w` = `missing_charge_wh` ÷ `remaining_hours`, `export_w` = `live_pv_w` − `max_charge_w`, `ac_output_limit` = `export_w`. **After:** restore selected mode. States: `curtailment.live_pv_w`, `missing_charge_wh`, `max_charge_w`, `export_w`, `remaining_hours`.

**Admin:** checkbox *Combiner box present* — without combiner: device ID + solarbank type + battery Wh; with combiner: combiner ID + up to **4** solarbank slots (each slot can be *none*). **Combiner:** total AC limit = **sum** of per-unit limits (SB2 **1000** W, SB3 Pro **1200** W, SB4 Pro **2500** W). **Standalone:** always **800** W.

---

## Changelog

### 0.10.17

- **Fix:** Stale `build/` still ran old curtailment code that set **grid export limit** (`grid_export_limit`) to up to **4800 W** on adapter start (App: *Netzeinspeisungs-Leistungsgrenze* → *Anpassen*). Rebuilt `build/` from current TypeScript; tests verify compiled curtailment never touches feed-in controls

### 0.10.16

- Combiner sensor **`total_state_of_charge`**: cloud total or capacity-weighted average of all site solarbanks (poll + ioBroker state)
- Curtailment uses total SOC for `missing_charge_wh`, `max_charge_w`, and `soc_percent`

### 0.10.15

- Curtailment: **`ac_output_limit` via API only** (no MQTT) to avoid station side effects
- Fix SOC handling when combiner had no SOC (`max_charge_w` wrong); ensure `missing_charge_wh` state exists on upgrade

### 0.10.14

- Curtailment: **only** manual mode + **`ac_output_limit`** (no `grid_export_limit`, `allow_grid_export`, home load preset, AC charge limit)
- New state `curtailment.missing_charge_wh`; active phase: export = live PV − calculated max charge

### 0.10.12

- Curtailment combiner: export via **`ac_output_limit`** (`max_load`); home load preset 0 W (superseded by 0.10.14+)

### 0.10.11

- Curtailment: prefer **`system.{siteId}.sensors.total_pv_power`** for live PV

### 0.10.10

- Curtailment combiner: export via `set_output_power` (later replaced); 4800 W cap; more PV sensors for `live_pv_w`

### 0.10.9

- Curtailment active phase: AC output = full PV (intermediate behaviour; refined in 0.10.14+)

### 0.10.8

- Curtailment: **before** = instant export = live PV; **active** = slow battery charge + export surplus

### 0.10.7

- Curtailment: export limit follows live PV; updates when generation sensors change

### 0.10.6

- Curtailment: manual mode, no charge, export limit from hourly forecast (also before curtailment window)

### 0.10.5

- Curtailment: read [solarprognose](https://github.com/ioBroker/ioBroker.solarprognose) forecast (kW → W, path `11h.power`)

### 0.10.4

- Curtailment Admin: combiner checkbox, device ID + solarbank type (standalone) or 4 slots with “none” (combiner); no usage-mode change before curtailment window

### 0.10.3

- CI: curtailment unit tests use Mocha/Chai (fixes adapter-check lint)

### 0.10.2

- Curtailment AC limits: standalone 800 W; combiner per unit SB2 1000, SB3 1200, SB4 2500 W

### 0.10.1

- Curtailment: Combiner limit = sum of per-unit profiles (max 4 mixed solarbanks)

### 0.10.0

- Optional **curtailment avoidance** via solarprognose forecast (Admin tab, `curtailment.*` states)

### 0.9.9

- `package.json` keyword `ioBroker`; entity group headers with schema `size` property

### 0.9.8

- Admin UI: all option/entity fields with lg/xl breakpoints; CI release fix

### 0.9.7

- Adapter-check: npm news sync, admin responsive layout, README copyright, npm package excludes Python cache

### 0.9.6

- Adapter-check compliance: Node 22+, admin UI sizes, compact-mode Python install, dependabot

### 0.9.5

- Admin warning before **Clear Anker login cache**; log after clear

### 0.9.4

- Log exact `authcache` path when login cache file is missing

### 0.9.3

- **Fix:** Valid `authcache` no longer treated as failed login after restart (captcha 100032)

### 0.9.2

- Keep `authcache` on re-auth; reload token on 401 before forced login

### 0.9.1

- Captcha error 100032 mapping and README troubleshooting

### 0.9.0

- Configurable **entity groups** (HA-style); API scope follows enabled groups

### 0.8.1

- Fix Python bridge `ApiCategories.device_parm` crash

### 0.8.0

- Daily energy statistics under `statistics.*`

### 0.7.0

- Usage mode `preset_usage_mode`, AC fast charge switch

### 0.6.x

- Persistent bridge daemon, HA-aligned poll, multisystem controls, rate-limit fixes

### 0.2.x – 0.5.x

- Python auto-install, device selection, staggered polling, repository rename

Older release notes: [CHANGELOG_OLD.md](CHANGELOG_OLD.md) and git history.

---

## Publishing (npm & ioBroker catalog)

**npm:** Release via git tag (`v*`) and CI deploy after [adapter check](https://adaptercheck.iobroker.in/) is green. Register in [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories) once the package is on npm.

---

## License

Copyright (c) 2026 MatthiasUlrich1 info@my-smart-home-support.de

MIT — see [LICENSE](LICENSE)
