# EV-Lader MQTT – HA-Funktionen & ioBroker-Roadmap

Referenz: Home Assistant [ha-anker-solix](https://github.com/thomluther/ha-anker-solix) / `solixapi` (Modell **A5191** V1 Smart EV Charger).

**Voraussetzung:** MQTT in den Adapter-Optionen aktiv, Wallbox im lokalen/MQTT-Modus.

## Implementierungsstand (ioBroker)

| Schritt | Thema | Status |
|--------|--------|--------|
| **1** | Ladebetrieb steuern (Start / Stop / Boost / Skip Delay) | erledigt |
| **2** | Zeitplan & Automatik | erledigt |
| **3** | Strom, Phasen, Solar | erledigt |
| 4 | Lastmanagement (Multisystem) | offen |
| 5 | Hardware / Komfort | offen |
| 6 | Live-Daten (MQTT-Sensoren erweitern) | offen |
| 7 | Solarbank `ev_charger_switch` (System) | offen |

---

## 1. Ladebetrieb steuern

| Funktion | MQTT |
|----------|------|
| Laden starten | `start_charge` (1) |
| Laden stoppen | `stop_charge` (2) |
| Boost | `boost_charge` (4) |
| Start-Verzögerung überspringen | `skip_delay` (3) |
| Gerät neu starten | `restart` (device_power_mode) |

HA: Select „EV charger mode“; virtuelle Anzeige-Zustände: `wait_plug`, `wait_start`.

---

## 2. Zeitplan & Automatik

| Funktion | MQTT-State / Befehl |
|----------|---------------------|
| Zeitplan ein/aus | `schedule_switch` |
| Zeitplan-Modus | normal / smart |
| Wochentags Start/Ende | `week_start_time`, `week_end_time` |
| Wochenende Start/Ende | `weekend_start_time`, `weekend_end_time` |
| Wochenende | same / different |
| Auto-Start | `auto_start_switch` |
| Laden nach Pause neu starten | `auto_charge_restart_switch` |
| Zufallsverzögerung | `random_delay_switch` (nur mit Hardware-Feature) |

---

## 3. Strom, Phasen, Solar

| Funktion | MQTT |
|----------|------|
| Max. Ladestrom | `max_evcharge_current` |
| Solar-Laden ein/aus | `solar_evcharge_switch` |
| Solar-Modus | solar_only / solar_grid |
| Mindeststrom Solar | `solar_evcharge_min_current` |
| Phasenbetrieb | `phase_operating_mode` |
| Auto-Phasenumschaltung | `auto_phase_switch` (3-phasig) |

---

## 4. Lastmanagement

| Funktion | MQTT |
|----------|------|
| Lastausgleich | `load_balance_switch` |
| Hauptsicherung | `main_breaker_limit` |
| Monitor-Gerät | `load_balance_monitor_device` (SN) |
| Solar-Monitoring | `solar_evcharge_monitor_*` |

---

## 5. Hardware / Komfort

| Funktion | MQTT |
|----------|------|
| Kabelverriegelung | `plug_lock_switch` |
| LED-Helligkeit | `light_brightness` |
| LED nachts aus | `light_off_schedule_*` |
| Touch-Modus | `smart_touch_mode` |
| Modbus TCP | `modbus_switch` |
| Swipe Hoch/Runter | `wipe_up_mode`, `wipe_down_mode` |

---

## 6. Live-Daten (MQTT, Auszug)

`ev_charger_status`, `plug_status`, `bat_charge_power`, `charging_energy`, Spannung/Strom/Leistung pro Phase, Countdowns, `boost_status`, OCPP-Status, Firmware.

---

## 7. Gesamtsystem

`solarbank` / Combiner: `ev_charger_switch` (cloud-driven, in Bibliothek oft eingeschränkt).

---

## Nicht in HA / Adapter

- Session-Historie als fertige Statistik-Entitäten (eher State-History).
- Prime-Lader (A2345, …) anderes MQTT-Feature-Set als A5191.
