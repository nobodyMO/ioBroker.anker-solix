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
7. Tab **Entities** (since v0.9.0): enable optional entity groups (energy statistics, power flows, PPS, EV charger, …). Only **Core** is on by default; everything else is off to limit API load. Restart the adapter after changes.

## State structure

HA-aligned entities per device under:

- `anker-solix.0.solarbank.<deviceId>.sensors.*` – e.g. `input_power`, `state_of_charge`, `dc_output_power`
- `anker-solix.0.solarbank.<deviceId>.control.*` – writable controls when supported
- `anker-solix.0.<device>.<id>.statistics.*` – daily energy statistics (kWh) when enabled in **Entities**
- `anker-solix.0.smartmeter.<deviceId>.sensors.*` – smart meter values
- `anker-solix.0.services.*` – schedule/export service buttons
- `anker-solix.0.info.connection`, `anker-solix.0.info.pythonReady`

## Troubleshooting login / poll

### `(100032) Captcha id empty`

Anker’s cloud sometimes blocks **direct API login** from servers (ioBroker host, VPS, VPN) and asks for captcha verification. The unofficial API cannot solve that captcha yet.

**Try in order:**

1. Log in with the **official Anker / Solix app** on a phone in the **same LAN** as ioBroker; confirm account and password work.
2. In adapter Admin → **Devices** → **Clear Anker login cache**, then save instance config again (re-enter password) and **restart** the adapter.
3. **Disable VPN** on the ioBroker machine; use the correct **country code** (e.g. `DE`, `AT`, `CH`) matching your Anker account.
4. If **Home Assistant** with [ha-anker-solix](https://github.com/thomluther/ha-anker-solix) works for the same account: copy the login cache file  
   `…/authcache/<your-email>.json` from HA into  
   `iobroker-data/anker-solix.0/authcache/` (same file name), then restart the adapter.
5. Wait **15–30 minutes** after many failed logins (rate limits) before retrying.

Daemon “unavailable” messages with the same captcha error are expected until login succeeds once.

## Disclaimer

This is **not** an official Anker product. The cloud API may change or break at any time. You use this adapter at your own risk.

## Credits

- [thomluther/ha-anker-solix](https://github.com/thomluther/ha-anker-solix) – Home Assistant integration and solixapi
- [thomluther/anker-solix-api](https://github.com/thomluther/anker-solix-api) – Python API library

## Changelog

### 0.9.1

- Map Anker API error **100032** (`Captcha id empty`) to `CaptchaRequiredError` with actionable log hints (DE/EN)
- Purge invalid login cache before re-auth; README **Troubleshooting login / poll** section

### 0.9.0

- **Configurable entity groups** (Admin tab **Entities**, HA-style): power flows, diagnostics, binary indicators, extended energy stats, PPS, EV charger, HES, smart plug, site price, account info, and more
- Optional groups are **off by default**; only **Core** (Solarbank, combiner, smart meter, existing controls) stays enabled
- API poll scope follows enabled groups (fewer cloud requests when groups are off)
- ~60 sensor definitions available when groups are enabled (advanced controls read-only for now)

### 0.8.1

- Fix Python bridge crash on start (`ApiCategories.device_parm` import error); polls and daemon work again
- Poll errors show Python stderr when the bridge returns no output

### 0.8.0

- **Daily energy statistics** (kWh) under `statistics.*` (solar production, charge/discharge, grid import/export, flows, yesterday values)
- Configurable via **Entities** → energy statistics (in 0.9.0 moved from Options; default off)

### 0.7.0

- **Usage mode** control `preset_usage_mode` (Custom, self-consumption, smart mode, dynamic tariff, time-of-use, …) with German labels
- **AC fast charge** switch `ac_fast_charge_switch` for Solarbank gen ≥ 2

### 0.6.5

- Fix `ac_charge_limit`: MQTT commands, power-limit poll, `all_ac_input_limit` on combiner (read-only)

### 0.6.3

- Fix combiner `ac_output_limit` (API 10004): MQTT parallel max load first, HA-aligned API fallback

### 0.6.2

- Fix control state min/max for multisystem AC output (up to 4800 W) and grid export limit 0

### 0.6.1

- Daemon: auth on first poll (not at start); one-shot bridge fallback when API rate-limited (26161)

### 0.6.0

- **Persistent bridge daemon** (`bridge.py serve`): API and MQTT session stay open like Home Assistant (no reconnect per poll/control)

### 0.5.0

- Poll cycle matches Home Assistant: interval counter, `requestDelay` / `endpointLimit`, MQTT on detail refresh
- Poll state in `authcache/poll_client_state.json`

### 0.4.2

- Staggered polling: sites every cycle, device/site details every Nth poll (`deviceDetailMultiplier`, default 10)
- Retries on transient API errors (429, 26161, busy)

### 0.4.1

- Debounced/serialized controls; MQTT-first AC charge limit; delayed poll after writes (rate-limit fix)

### 0.4.0

- Multisystem controls: total PV, SOC reserve, PV/AC limits, AC output limit, grid export switch/limit (Power Dock/combiner)

### 0.3.0

- Repository renamed to `ioBroker.anker-solix` (fixes `iob url` and Admin display)

### 0.2.7

- Admin: remove legacy GitHub install symlink; uniform display name

### 0.2.6

- Auth: correct instance cache path; retry on stale token

### 0.2.5

- Fix control state types (`grid_export_limit` as number for js-controller 7)

### 0.2.4

- GitHub install symlink for old repo name (superseded by 0.3.0)

### 0.2.3

- Remove npm `postinstall` (fixes ioBroker install); Python setup on adapter start only

### 0.2.2

- Fallback: `pip install --target python/site-packages` when `python3-venv` is missing

### 0.2.0

- Python auto-install, smart meter entities, HA services, device selection in admin

### 0.1.0

- HA-aligned Solarbank sensors and controls

### 0.0.1

- Initial release

## Publishing (npm & ioBroker catalog)

The adapter is already installable from GitHub:

```bash
iobroker url https://github.com/MatthiasUlrich1/ioBroker.anker-solix
```

To publish on **npm** (so users can run `iobroker install anker-solix` without GitHub):

### 1. Prerequisites

- GitHub **Actions** green (`Test and Release` workflow: lint, build, package tests)
- [ioBroker Adapter Checker](https://adaptercheck.iobroker.in/) – open the repo URL or upload a release ZIP; fix reported issues
- npm account and [2FA](https://docs.npmjs.com/about-two-factor-authentication) enabled
- Package name `iobroker.anker-solix` must be free on npm (or you must own it)

### 2. Publish to npm

On your development machine, in the adapter directory:

```bash
npm login
npm run build
npm publish --access public
```

Or use the ioBroker release script (bumps version, builds, publishes – review `.releaseconfig.json`):

```bash
npm run release
```

Follow the prompts (version bump, changelog, manual review step).

### 3. Register in the official ioBroker repository

After the package exists on npm:

1. Open [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories) and read `README.md`
2. Add the adapter to the correct list (stable / beta), typically via pull request with:
   - npm package name: `iobroker.anker-solix`
   - version to expose
   - short description and link to your GitHub repo
3. Alternatively use the [add-adapter form](https://github.com/ioBroker/ioBroker.repositories/issues/new/choose) if available

After merge, the adapter appears in Admin → **Adapter** search and in `iobroker update available`.

### 4. Recommended before first publication

- README and `io-package.json` version in sync (currently **0.9.1**)
- Test a clean install on a Linux ioBroker host: `iobroker url` → `iobroker upload` → instance + poll
- Mention unofficial API and Python 3.12+ in the ioBroker forum thread when announcing

**Note:** GitHub install (`iob url`) can stay your primary channel; npm is optional but needed for the official ioBroker adapter list and one-click install without git.

## License

MIT – see [LICENSE](LICENSE)
