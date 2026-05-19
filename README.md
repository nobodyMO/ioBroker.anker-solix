# AnkerSolix (ioBroker adapter)

[![NPM version](https://img.shields.io/npm/v/iobroker.anker-solix.svg)](https://www.npmjs.com/package/iobroker.anker-solix)

ioBroker adapter for **Anker Solix** power systems (Solarbank, Smart Meter, PPS, and more), modeled after the Home Assistant integration [thomluther/ha-anker-solix](https://github.com/thomluther/ha-anker-solix).

The adapter uses the same unofficial **solixapi** Python library that is embedded in the HA integration. A small Python bridge polls the Anker cloud and exposes values as ioBroker states.

## Requirements

- ioBroker with **js-controller >= 6** and **admin >= 7**
- **Node.js >= 20**
- **Python 3.12+** on the ioBroker host
- Python packages (once per host):

```bash
pip install -r python/requirements.txt
```

On Windows you can use `py -3 -m pip install -r python/requirements.txt`.

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
- `anker-solix.0.system.<siteId>.sensors.*` – system totals where available
- `anker-solix.0.account.nickname` – account nickname
- `anker-solix.0.info.connection` – cloud connection indicator

Controls use the same API/MQTT paths as the [HA integration](https://github.com/thomluther/ha-anker-solix). Not every device model supports every control.

## Disclaimer

This is **not** an official Anker product. The cloud API may change or break at any time. You use this adapter at your own risk.

## Credits

- [thomluther/ha-anker-solix](https://github.com/thomluther/ha-anker-solix) – Home Assistant integration and solixapi
- [thomluther/anker-solix-api](https://github.com/thomluther/anker-solix-api) – Python API library

## License

MIT – see [LICENSE](LICENSE)
