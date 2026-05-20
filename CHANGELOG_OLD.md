# Older changelog entries (moved from io-package.json common.news)

## 0.9.5 – 0.9.0

See git history / GitHub releases for 0.9.x notes (login cache, entity groups, captcha handling).

## 0.8.1

- **en:** Fix Python bridge import crash (invalid ApiCategories.device_parm)
- **de:** Python-Bridge-Absturz behoben (ungültiges ApiCategories.device_parm)

## 0.8.0

- **en:** Daily energy statistics (kWh) under statistics.*; enabled by default
- **de:** Tagesstatistiken (kWh) unter statistics.*; standardmäßig aktiv

## 0.7.0

- **en:** Add usage mode (preset_usage_mode) and AC fast charge switch
- **de:** Nutzungsmodus (Benutzerdefiniert, Eigenverbrauch, Smart, …) und Schnellladung

## 0.6.5

- **en:** Fix ac_charge_limit: MQTT cmds, power limit poll, all_ac_input_limit on combiner (read)
- **de:** ac_charge_limit: MQTT-Befehle, Power-Limit-Poll, all_ac_input_limit am Combiner (lesen)

## 0.6.3

- **en:** Fix combiner ac_output_limit (10004): MQTT parallel max load + HA-aligned API fallback
- **de:** Combiner ac_output_limit (10004): MQTT-Parallel-Last + HA-konformer API-Fallback

## 0.6.2

- **en:** Fix control state min/max for multisystem AC output (4800 W) and grid export limit 0
- **de:** Min/Max der Steuer-States für Multisystem AC-Ausgang (4800 W) und Netzeinspeisung 0 korrigiert

## 0.6.1

- **en:** Daemon: deferred auth on start, one-shot fallback if API rate-limited (26161)
- **de:** Daemon: Auth erst beim Poll, One-Shot-Fallback bei API-Limit (26161)

## 0.6.0

- **en:** Persistent Python bridge daemon: API and MQTT session stay open like Home Assistant
- **de:** Persistenter Python-Bridge-Daemon: API- und MQTT-Session bleiben wie in Home Assistant offen

## 0.5.0

- **en:** Poll cycle matches Home Assistant: interval counter, API delay/throttle, MQTT on detail refresh
- **de:** Poll-Zyklus wie Home Assistant: Intervallzähler, API-Delay/Throttle, MQTT bei Detail-Refresh

## 0.4.2

- **en:** Staggered polling like HA (sites every cycle, device details every 5th poll) plus API retries
- **de:** Gestaffeltes Polling wie HA (Sites jedes Mal, Gerätedetails jedes 5. Mal) plus API-Wiederholungen

## 0.4.1

- **en:** Rate-limit fix: debounced/serialized controls, MQTT-first AC charge limit, delayed poll after writes
- **de:** Rate-Limit-Fix: entprellte/serialisierte Steuerungen, MQTT zuerst für AC-Ladelimit, verzögertes Poll nach Schreibvorgängen

## 0.4.0

- **en:** Multisystem controls: total PV, SOC reserve, PV/AC limits, AC output limit, grid export switch/limit
- **de:** Multisystem-Steuerungen: Gesamt-PV, SOC-Reserve, PV/AC-Limits, AC-Ausgangs-Limit, Netzeinspeisung Schalter/Limit

## 0.3.0

- **en:** GitHub repository renamed to ioBroker.anker-solix
- **de:** GitHub-Repository umbenannt in ioBroker.anker-solix

## 0.2.7

- **en:** Admin tile: remove GitHub install symlink, normalize display name (Anker Solix)
- **de:** Admin-Kachel: GitHub-Symlink entfernt, einheitlicher Anzeigename (Anker Solix)
