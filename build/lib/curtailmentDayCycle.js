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
var curtailmentDayCycle_exports = {};
__export(curtailmentDayCycle_exports, {
  berlinDateString: () => berlinDateString,
  enterAwaitingForecastIfNewDay: () => enterAwaitingForecastIfNewDay,
  forecastSignature: () => forecastSignature,
  getCurtailmentDayCycleState: () => getCurtailmentDayCycleState,
  isAwaitingForecastRefresh: () => isAwaitingForecastRefresh,
  markControlsReleasedForAwaiting: () => markControlsReleasedForAwaiting,
  resetCurtailmentDayCycleForTests: () => resetCurtailmentDayCycleForTests,
  shouldReleaseControlsForAwaiting: () => shouldReleaseControlsForAwaiting
});
module.exports = __toCommonJS(curtailmentDayCycle_exports);
function berlinDateString(now = /* @__PURE__ */ new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}
function forecastSignature(forecast) {
  const parts = [];
  for (const h of [...forecast.hours.keys()].sort((a, b) => a - b)) {
    parts.push(`${h}:${forecast.hours.get(h)}`);
  }
  return parts.join("|");
}
const cycle = {
  berlinDate: "",
  awaitingForecast: false,
  forecastSigAtDayBoundary: null,
  controlsReleasedForAwaiting: false
};
function resetCurtailmentDayCycleForTests() {
  cycle.berlinDate = "";
  cycle.awaitingForecast = false;
  cycle.forecastSigAtDayBoundary = null;
  cycle.controlsReleasedForAwaiting = false;
}
function getCurtailmentDayCycleState() {
  return cycle;
}
function enterAwaitingForecastIfNewDay(berlinDate, forecast) {
  if (berlinDate !== cycle.berlinDate) {
    cycle.berlinDate = berlinDate;
    cycle.awaitingForecast = true;
    cycle.forecastSigAtDayBoundary = forecastSignature(forecast);
    cycle.controlsReleasedForAwaiting = false;
  }
  return cycle.awaitingForecast;
}
function isAwaitingForecastRefresh(forecast) {
  if (!cycle.awaitingForecast) {
    return false;
  }
  if (forecastSignature(forecast) !== cycle.forecastSigAtDayBoundary) {
    cycle.awaitingForecast = false;
    cycle.forecastSigAtDayBoundary = null;
    cycle.controlsReleasedForAwaiting = false;
    return false;
  }
  return true;
}
function markControlsReleasedForAwaiting() {
  cycle.controlsReleasedForAwaiting = true;
}
function shouldReleaseControlsForAwaiting() {
  return cycle.awaitingForecast && !cycle.controlsReleasedForAwaiting;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  berlinDateString,
  enterAwaitingForecastIfNewDay,
  forecastSignature,
  getCurtailmentDayCycleState,
  isAwaitingForecastRefresh,
  markControlsReleasedForAwaiting,
  resetCurtailmentDayCycleForTests,
  shouldReleaseControlsForAwaiting
});
//# sourceMappingURL=curtailmentDayCycle.js.map
