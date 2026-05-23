"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var curtailmentForecast_exports = {};
__export(curtailmentForecast_exports, {
  currentPhase: () => currentPhase,
  detectCurtailmentWindow: () => detectCurtailmentWindow,
  forecastExportTargetW: () => forecastExportTargetW,
  forecastPowerAtHour: () => forecastPowerAtHour,
  normalizeForecastPowerW: () => normalizeForecastPowerW,
  readHourlyForecast: () => readHourlyForecast,
  remainingCurtailmentHours: () => remainingCurtailmentHours
});
module.exports = __toCommonJS(curtailmentForecast_exports);
const FORECAST_HOURS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
function normalizeForecastPowerW(raw, unit) {
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  const u = (unit || "").trim().toLowerCase();
  if (u === "kw" || u === "kilowatt" || u === "kilowatts") {
    return Math.round(raw * 1e3);
  }
  if (u === "w" || u === "watt" || u === "watts") {
    return Math.round(raw);
  }
  if (raw < 200) {
    return Math.round(raw * 1e3);
  }
  return Math.round(raw);
}
function hourStateCandidates(base, hour) {
  const hourKey = hour.toString().padStart(2, "0");
  return [
    // ioBroker.solarprognose 2.x: forecast.00.hourly.11h.power (kW)
    `${base}.${hourKey}h.power`,
    `${base}.${hourKey}.power`,
    `${base}.${hour}.power`,
    `${base}.${hourKey}-hour.power`,
    `${base}.hour_${hourKey}.power`
  ];
}
async function readHourlyForecast(basePath, getState, getObject) {
  const base = basePath.replace(/\.$/, "");
  const hours = /* @__PURE__ */ new Map();
  for (const h of FORECAST_HOURS) {
    for (const id of hourStateCandidates(base, h)) {
      const st = await getState(id);
      if ((st == null ? void 0 : st.val) !== null && (st == null ? void 0 : st.val) !== void 0 && st.val !== "") {
        const raw = Number(st.val);
        if (!Number.isNaN(raw)) {
          let unit;
          if (getObject) {
            const obj = await getObject(id);
            const common = obj == null ? void 0 : obj.common;
            unit = common == null ? void 0 : common.unit;
          }
          hours.set(h, normalizeForecastPowerW(raw, unit));
          break;
        }
      }
    }
  }
  return { hours };
}
function detectCurtailmentWindow(forecast, acLimitW) {
  var _a, _b;
  const overHours = [];
  for (const [h, power] of forecast.hours) {
    if (power > acLimitW) {
      overHours.push(h);
    }
  }
  if (!overHours.length) {
    return {
      today: false,
      startHour: 0,
      endHour: 0,
      durationHours: 0,
      chargeDivisorHours: 0
    };
  }
  overHours.sort((a, b) => a - b);
  const startHour = (_a = overHours[0]) != null ? _a : 0;
  const endHour = (_b = overHours[overHours.length - 1]) != null ? _b : 0;
  const durationHours = endHour - startHour + 1;
  return {
    today: true,
    startHour,
    endHour,
    durationHours,
    chargeDivisorHours: durationHours + 1
  };
}
function currentPhase(window, nowHour) {
  if (!window.today) {
    return "idle";
  }
  if (nowHour < window.startHour) {
    return "before";
  }
  if (nowHour <= window.endHour) {
    return "active";
  }
  return "after";
}
function remainingCurtailmentHours(window, nowHour) {
  if (!window.today || nowHour > window.endHour) {
    return 0;
  }
  return Math.max(0, window.endHour - nowHour + 1);
}
function forecastPowerAtHour(forecast, hour) {
  var _a;
  return (_a = forecast.hours.get(hour)) != null ? _a : 0;
}
function forecastExportTargetW(forecast, nowHour, window) {
  if (!window.today) {
    return 0;
  }
  const current = forecastPowerAtHour(forecast, nowHour);
  if (current > 0) {
    return current;
  }
  if (nowHour < window.startHour) {
    const atStart = forecastPowerAtHour(forecast, window.startHour);
    if (atStart > 0) {
      return atStart;
    }
  }
  let peak = 0;
  for (let h = window.startHour; h <= window.endHour; h++) {
    peak = Math.max(peak, forecastPowerAtHour(forecast, h));
  }
  return peak;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  currentPhase,
  detectCurtailmentWindow,
  forecastExportTargetW,
  forecastPowerAtHour,
  normalizeForecastPowerW,
  readHourlyForecast,
  remainingCurtailmentHours
});
//# sourceMappingURL=curtailmentForecast.js.map
