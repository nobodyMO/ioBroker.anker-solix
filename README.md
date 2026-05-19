# ioBroker.anker-solix

[![NPM version](https://img.shields.io/npm/v/iobroker.anker-solix.svg)](https://www.npmjs.com/package/iobroker.anker-solix)

ioBroker adapter for **Anker Solix** power systems (Solarbank, Smart Meter, PPS, and more), modeled after the Home Assistant integration [thomluther/ha-anker-solix](https://github.com/thomluther/ha-anker-solix).

The adapter uses the same unofficial **solixapi** Python library that is embedded in the HA integration. A small Python bridge polls the Anker cloud and exposes values as ioBroker states.

## Requirements

- ioBroker with **js-controller >= 6** and **admin >= 7**
- **Node.js >= 20**
- **Python 3.12+** on the ioBroker host (`python3` is enough; **recommended** on Debian/Ubuntu: `sudo apt install python3-venv python3-pip`)
- Python packages are installed inside the adapter folder:
  - preferred: **`python/.venv`**
  - fallback (no `python3-venv`): **`python/site-packages`** via `pip install --target` (PEP 668 safe, adapter-local only)

Manual setup (if needed):

```bash
cd node_modules/iobroker.anker-solix
python3 -m venv python/.venv
python/.venv/bin/pip install -r python/requirements.txt
```

On Windows use `py -3 -m venv python\.venv` and `python\.venv\Scripts\pip`.

Since **v0.2.0**, dependencies are installed automatically on adapter start (see **Options** → `autoInstallPython`) or via the admin button **Install Python dependencies**.

## Installation

```bash
iobroker url https://github.com/MatthiasUlrich1/ioBroker.anker-solix
```

Or from npm (when published):

```bash
iobroker install anker-solix
```

**Multihost:** use `--host "PC(SmartHome)"` with quotes if the host name contains special characters. Install on the host where `node_modules` lives, or run `iob url` on each slave.

**Legacy repo URL:** `MatthiasUlrich1/AnkerSolix` redirects to this repository on GitHub. Use the new URL for `iob url`.

Remove old install symlink if present:

```bash
rm -f /opt/iobroker/node_modules/iobroker.AnkerSolix
```

## Configuration

1. Create an instance: `iobroker add anker-solix`
2. Enter your Anker account e-mail and password in the instance config (save after entering password).
3. Set the country code (e.g. `DE`) matching your Anker account.
4. Accept the usage terms (unofficial API – use at your own risk).
5. Poll interval **60–180 seconds** (same as HA integration).
6. Optional: enable **MQTT** for additional device data.

## State structure

HA-aligned entities per device under:

- `anker-solix.0.solarbank.<deviceId>.sensors.*` – e.g. `input_power`, `state_of_charge`, `dc_output_power`
- `anker-solix.0.solarbank.<deviceId>.control.*` – writable controls when supported
- `anker-solix.0.smartmeter.<deviceId>.sensors.*` – smart meter values
- `anker-solix.0.services.*` – schedule/export service buttons
- `anker-solix.0.info.connection`, `anker-solix.0.info.pythonReady`

## Disclaimer

This is **not** an official Anker product. The cloud API may change or break at any time. You use this adapter at your own risk.

## Credits

- [thomluther/ha-anker-solix](https://github.com/thomluther/ha-anker-solix) – Home Assistant integration and solixapi
- [thomluther/anker-solix-api](https://github.com/thomluther/anker-solix-api) – Python API library

## Changelog

### 0.4.2

- Poll matches HA load pattern: `update_sites` every interval, `update_device_details` / `update_site_details` only every 5th poll (configurable via `deviceDetailMultiplier`)
- Retries on transient API errors (429, 26161, busy); 0.5 s delay between requests

### 0.4.1

- Control writes are debounced and serialized (avoids Anker API 429 when changing several Solarbanks)
- AC charge limit prefers MQTT when available; poll runs 12 s after the last control (not after each write)

### 0.4.0

- **Sensors:** total PV generation (`total_pv_power`) on system/combiner (Power Dock), per-device PV/AC limit readouts
- **Controls (HA-aligned, multisystem):** SOC reserve (`min_soc`), grid export switch/limit, AC output limit (max home load), PV input limit and AC charge limit per Solarbank
- Station/Power Dock/combiner targets use the same API logic as the Home Assistant integration (3rd-party PV switch is not exposed)

### 0.3.0

- **GitHub repository renamed** to `ioBroker.anker-solix` (fixes `iob url` install and Admin tile name)
- Removed symlink workaround for old repo name `AnkerSolix`

### 0.2.7

- Admin tile: remove legacy GitHub install symlink

### 0.2.6

- Auth: correct instance cache path, stale login retry

### 0.2.5

- Fix control state types for js-controller 7 (`grid_export_limit` as number)

### 0.2.4

- GitHub install symlink (superseded by repo rename in 0.3.0)

### 0.2.0

- Python auto-install, smart meter, HA services, device selection in admin

### 0.1.0

- HA-aligned Solarbank sensors and controls

### 0.0.1

- Initial release

## License

MIT – see [LICENSE](LICENSE)
