# AnkerSolix (ioBroker adapter)

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

Since **v0.2.0**, dependencies are installed automatically on adapter start (see **Options** → `autoInstallPython`) or via the admin button **Install Python dependencies**. `npm postinstall` only runs a best-effort check and does **not** abort the ioBroker install.

## Installation (GitHub / Multihost)

### GitHub repo name vs. npm package name

This repository is named **`AnkerSolix`** on GitHub, but the npm/ioBroker package is **`iobroker.anker-solix`**. ioBroker’s installer looks for `node_modules/iobroker.AnkerSolix` after `iob url` – that caused `Cannot install … : 0` even when npm succeeded. **v0.2.4+** creates a symlink automatically in `postinstall`. Manual fix (older versions):

```bash
cd /opt/iobroker/node_modules
ln -sfn iobroker.anker-solix iobroker.AnkerSolix
iobroker url https://github.com/MatthiasUlrich1/AnkerSolix
```

Long-term: rename the GitHub repository to **`ioBroker.anker-solix`** (ioBroker convention).

**npm install succeeded but adapter missing in Admin?** This is usually **not** a Python issue.

1. Check the package exists:

```bash
ls /opt/iobroker/node_modules/iobroker.anker-solix/io-package.json
```

2. Restart ioBroker and refresh Admin (F5):

```bash
iobroker restart
```

3. In Admin → **Adapters** → tab **Installed** (not only “Available”), host selector = machine where npm ran (often `iobroker`, not a remote slave).

4. **Multihost:** `iob url` installs npm on the **master**. Remote hosts (e.g. `PC(SmartHome)`) may report `Cannot install … : 0` until the adapter is installed there too. Either:
   - run instances on the master host, or
   - on the slave: `iob url https://github.com/MatthiasUlrich1/AnkerSolix` (on that host), or
   - quote host names with special characters: `iob url … --host "PC(SmartHome)"`

5. Manual install (reliable):

```bash
cd /opt/iobroker
npm install github:MatthiasUlrich1/AnkerSolix
iobroker restart
```

Python packages are installed on **first adapter start** (or via Admin → Install Python dependencies), not during `npm install`.

## Configuration

1. Install the adapter from GitHub or npm (`iobroker.anker-solix`).
2. Create an instance and enter your Anker account e-mail and password.
3. Set the country code (e.g. `DE`) matching your Anker account.
4. Accept the usage terms (unofficial API – use at your own risk).
5. Start with a poll interval of **60–180 seconds** (same recommendation as in the HA integration).
6. Optional: enable **MQTT** for additional device data (as in HA).

## State structure (v0.1.0+)

HA-aligned entities per device under:

- `anker-solix.0.solarbank.<deviceId>.sensors.*` – e.g. `input_power`, `state_of_charge`, `dc_output_power`, `battery_power`, `grid_power`, `home_power`
- `anker-solix.0.solarbank.<deviceId>.control.*` – writable: `allow_grid_export`, `preset_allow_export`, `set_output_power`, `min_soc`, `grid_export_limit` (when supported by your device/API)
- `anker-solix.0.smartmeter.<deviceId>.sensors.*` – smart meter values (v0.2.0+), e.g. `grid_to_home_power`, `grid_status_desc`, energy counters
- `anker-solix.0.system.<siteId>.sensors.*` – system totals where available
- `anker-solix.0.services.*` – service buttons and result states (v0.2.0+)
- `anker-solix.0.account.nickname` – account nickname
- `anker-solix.0.info.connection` – cloud connection indicator
- `anker-solix.0.info.pythonReady` – Python dependencies ready (v0.2.0+)

Controls use the same API/MQTT paths as the [HA integration](https://github.com/thomluther/ha-anker-solix). Not every device model supports every control.

## Disclaimer

This is **not** an official Anker product. The cloud API may change or break at any time. You use this adapter at your own risk.

## Credits

- [thomluther/ha-anker-solix](https://github.com/thomluther/ha-anker-solix) – Home Assistant integration and solixapi
- [thomluther/anker-solix-api](https://github.com/thomluther/anker-solix-api) – Python API library

## Changelog

### 0.2.4

- **Fix `iob url` / GitHub install:** symlink `iobroker.AnkerSolix` → `iobroker.anker-solix` (repo name `AnkerSolix` vs package name)

### 0.2.3

- Removed `npm postinstall` so `iobroker url` / GitHub install is not blocked; Python setup runs on adapter start only

### 0.2.2

- **Fallback without `python3-venv`:** if `venv` cannot be created (`ensurepip`), packages install to `python/site-packages` automatically
- postinstall logs only to stdout (avoids false install errors)

### 0.2.1

- **Install fix (Debian/Ubuntu / PEP 668):** Python dependencies go into `python/.venv` instead of system pip; `npm postinstall` no longer fails `iobroker url` / adapter installation
- Bridge uses venv Python automatically when `python/.venv` exists

### 0.2.0

- **Python auto-install:** `npm postinstall` and optional install on adapter start (`autoInstallPython`) run `tools/install-python.js` to install packages from `python/requirements.txt`; manual install via admin button **Install Python dependencies**; state `info.pythonReady`
- **Smart meter entities:** `grid_to_home_power`, `grid_status_desc`, `grid_import_energy`, `grid_export_energy`, `daily_grid_import`, `daily_grid_export`, `phase`, `smartmeter_list` (under `smartmeter.<deviceId>.sensors.*` when present)
- **HA-style services** (button states under `anker-solix.0.services.*`): `get_schedule` → `schedule_json`, `clear_schedule`, `export_systems` → `export_result`, `get_system_info` → `system_info`, `refresh_devices`
- **Admin device selection:** new **Devices** tab – load device list from cloud, filter by site ID and device serial numbers, `enableAllDevices` toggle; `messagebox` enabled for admin `sendTo` commands
- New config options: `autoInstallPython`, `enableAllDevices`, `selectedSiteId`, `selectedDeviceIds`, `deviceListJson`

### 0.1.0

- HA-aligned Solarbank sensors and control entities (`input_power`, `state_of_charge`, `allow_grid_export`, `set_output_power`, `min_soc`, etc.)
- Python bridge with vendored **solixapi** (same as HA integration)
- CI workflows, author metadata update

### 0.0.1

- Initial release based on [ha-anker-solix](https://github.com/thomluther/ha-anker-solix)

## License

MIT – see [LICENSE](LICENSE)
