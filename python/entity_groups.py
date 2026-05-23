"""Entity feature groups (instance config) ↔ API exclude categories / poll scope."""

from __future__ import annotations

from solixapi.apitypes import ApiCategories, SolixDeviceType

# Entity groups (must match admin config keys → enabledEntityGroups in bridge config)
GROUP_CORE = "core"
GROUP_ENERGY_STATISTICS = "energy_statistics"
GROUP_ENERGY_STATISTICS_WEEK = "energy_statistics_week"
GROUP_ENERGY_STATISTICS_MONTH = "energy_statistics_month"
GROUP_ENERGY_STATISTICS_YEAR = "energy_statistics_year"
GROUP_ENERGY_DETAIL = "energy_detail"
GROUP_POWER_FLOWS = "power_flows"
GROUP_DIAGNOSTICS = "diagnostics"
GROUP_BINARY = "binary"
GROUP_ADVANCED_CONTROLS = "advanced_controls"
GROUP_SYSTEM_OVERVIEW = "system_overview"
GROUP_SITE_PRICE = "site_price"
GROUP_ACCOUNT = "account"
GROUP_SOLARBANK_META = "solarbank_meta"
GROUP_SMARTPLUG = "smartplug"
GROUP_PPS = "pps"
GROUP_EV_CHARGER = "ev_charger"
GROUP_VEHICLE = "vehicle"
GROUP_HES = "hes"
GROUP_POWER_PANEL = "powerpanel"
GROUP_INVERTER = "inverter"

# Config property names (ioBroker native) — all optional groups default OFF in io-package.json
CONFIG_GROUP_KEYS: tuple[str, ...] = (
    "enableCoreEntities",
    "enableEnergyStatistics",
    "enableEnergyDetail",
    "enablePowerFlows",
    "enableDiagnostics",
    "enableBinaryIndicators",
    "enableAdvancedControls",
    "enableSystemOverview",
    "enableSitePrice",
    "enableAccountInfo",
    "enableSolarbankMeta",
    "enableSmartplug",
    "enablePps",
    "enableEvCharger",
    "enableVehicle",
    "enableHes",
    "enablePowerPanel",
    "enableInverter",
)

_CONFIG_TO_ENTITY_GROUP: dict[str, str] = {
    "enableCoreEntities": GROUP_CORE,
    "enableEnergyStatistics": GROUP_ENERGY_STATISTICS,
    "enableEnergyStatisticsWeek": GROUP_ENERGY_STATISTICS_WEEK,
    "enableEnergyStatisticsMonth": GROUP_ENERGY_STATISTICS_MONTH,
    "enableEnergyStatisticsYear": GROUP_ENERGY_STATISTICS_YEAR,
    "enableEnergyDetail": GROUP_ENERGY_DETAIL,
    "enablePowerFlows": GROUP_POWER_FLOWS,
    "enableDiagnostics": GROUP_DIAGNOSTICS,
    "enableBinaryIndicators": GROUP_BINARY,
    "enableAdvancedControls": GROUP_ADVANCED_CONTROLS,
    "enableSystemOverview": GROUP_SYSTEM_OVERVIEW,
    "enableSitePrice": GROUP_SITE_PRICE,
    "enableAccountInfo": GROUP_ACCOUNT,
    "enableSolarbankMeta": GROUP_SOLARBANK_META,
    "enableSmartplug": GROUP_SMARTPLUG,
    "enablePps": GROUP_PPS,
    "enableEvCharger": GROUP_EV_CHARGER,
    "enableVehicle": GROUP_VEHICLE,
    "enableHes": GROUP_HES,
    "enablePowerPanel": GROUP_POWER_PANEL,
    "enableInverter": GROUP_INVERTER,
}

ENERGY_API_CATEGORIES: list[str] = [
    ApiCategories.solarbank_energy,
    ApiCategories.solarbank_pps_energy,
    ApiCategories.smartmeter_energy,
    ApiCategories.solar_energy,
    ApiCategories.smartplug_energy,
    ApiCategories.charger_energy,
    ApiCategories.powerpanel_energy,
    ApiCategories.hes_energy,
]

META_API_CATEGORIES: list[str] = [
    ApiCategories.solarbank_solar_info,
    ApiCategories.solarbank_fittings,
    ApiCategories.solarbank_cutoff,
    ApiCategories.device_auto_upgrade,
    ApiCategories.device_tag,
]

OPTIONAL_DEVICE_TYPES: dict[str, str] = {
    GROUP_SMARTPLUG: SolixDeviceType.SMARTPLUG.value,
    GROUP_PPS: SolixDeviceType.PPS.value,
    GROUP_EV_CHARGER: SolixDeviceType.EV_CHARGER.value,
    GROUP_VEHICLE: SolixDeviceType.VEHICLE.value,
    GROUP_HES: SolixDeviceType.HES.value,
    GROUP_POWER_PANEL: SolixDeviceType.POWERPANEL.value,
    GROUP_INVERTER: SolixDeviceType.INVERTER.value,
}

# Extra device types polled when a group is enabled (also enable related energy category)
_DEVICE_TYPE_EXTRAS: dict[str, list[str]] = {
    GROUP_PPS: [
        SolixDeviceType.SOLARBANK_PPS.value,
        SolixDeviceType.POWERBANK.value,
        SolixDeviceType.CHARGER.value,
        SolixDeviceType.POWERCOOLER.value,
    ],
    GROUP_SMARTPLUG: [SolixDeviceType.SMARTPLUG.value],
    GROUP_EV_CHARGER: [SolixDeviceType.EV_CHARGER.value, SolixDeviceType.CHARGER.value],
}

_AVG_POWER_CATEGORIES = [
    ApiCategories.powerpanel_avg_power,
    ApiCategories.hes_avg_power,
]


def enabled_entity_groups(config: dict) -> set[str]:
    """Return active entity groups from bridge/adapter config."""
    groups: set[str] = set()
    for cfg_key, group in _CONFIG_TO_ENTITY_GROUP.items():
        val = config.get(cfg_key)
        if cfg_key == "enableCoreEntities":
            if val is not False:
                groups.add(group)
        elif val:
            groups.add(group)
    return groups


def entity_spec_enabled(spec: dict, enabled: set[str]) -> bool:
    spec_groups = spec.get("groups") or [GROUP_CORE]
    return any(g in enabled for g in spec_groups)


def build_exclude_categories(config: dict) -> list[str]:
    """Build API exclude set: everything optional off unless enabled in config."""
    enabled = enabled_entity_groups(config)
    exclude: set[str] = set()

    if GROUP_SITE_PRICE not in enabled:
        exclude.add(ApiCategories.site_price)
    if GROUP_ACCOUNT not in enabled:
        exclude.add(ApiCategories.account_info)
    if GROUP_SOLARBANK_META not in enabled:
        exclude.update(META_API_CATEGORIES)
    elif ApiCategories.device_auto_upgrade in exclude:
        exclude.discard(ApiCategories.device_auto_upgrade)
    _energy_poll = {
        GROUP_ENERGY_STATISTICS,
        GROUP_ENERGY_DETAIL,
        GROUP_ENERGY_STATISTICS_WEEK,
        GROUP_ENERGY_STATISTICS_MONTH,
        GROUP_ENERGY_STATISTICS_YEAR,
    }
    if not (_energy_poll & enabled):
        exclude.update(ENERGY_API_CATEGORIES)
    elif GROUP_ENERGY_STATISTICS not in enabled:
        # Detail-only still needs base energy poll for some fields — keep categories, filter entities
        pass
    if GROUP_POWER_PANEL not in enabled and GROUP_HES not in enabled:
        exclude.update(_AVG_POWER_CATEGORIES)

    for group, dev_type in OPTIONAL_DEVICE_TYPES.items():
        if group not in enabled:
            exclude.add(dev_type)
            for extra in _DEVICE_TYPE_EXTRAS.get(group, []):
                exclude.add(extra)

    if GROUP_INVERTER not in enabled:
        exclude.add(SolixDeviceType.INVERTER.value)
    if GROUP_VEHICLE not in enabled:
        exclude.add(SolixDeviceType.VEHICLE.value)
    if GROUP_SMARTPLUG not in enabled:
        exclude.add(SolixDeviceType.SMARTPLUG.value)
    # Legacy explicit exclude list from config (advanced)
    for item in config.get("exclude") or []:
        exclude.add(str(item))

    return sorted(exclude)
