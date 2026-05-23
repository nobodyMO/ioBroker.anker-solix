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
var combinerSoc_exports = {};
__export(combinerSoc_exports, {
  aggregateSolarbankSoc: () => aggregateSolarbankSoc,
  normalizeSocPercent: () => normalizeSocPercent
});
module.exports = __toCommonJS(combinerSoc_exports);
function aggregateSolarbankSoc(banks) {
  var _a;
  if (!banks.length) {
    return void 0;
  }
  if (banks.length === 1) {
    return (_a = banks[0]) == null ? void 0 : _a.socPercent;
  }
  const withCap = banks.filter((b) => {
    var _a2;
    return ((_a2 = b.capacityWh) != null ? _a2 : 0) > 0;
  });
  if (withCap.length === banks.length) {
    const totalCap = withCap.reduce((s, b) => {
      var _a2;
      return s + ((_a2 = b.capacityWh) != null ? _a2 : 0);
    }, 0);
    if (totalCap <= 0) {
      return void 0;
    }
    const weighted = withCap.reduce((s, b) => {
      var _a2;
      return s + b.socPercent * ((_a2 = b.capacityWh) != null ? _a2 : 0);
    }, 0) / totalCap;
    return Math.round(weighted * 10) / 10;
  }
  const avg = banks.reduce((s, b) => s + b.socPercent, 0) / banks.length;
  return Math.round(avg * 10) / 10;
}
function normalizeSocPercent(raw) {
  if (raw === null || raw === void 0 || raw === "") {
    return void 0;
  }
  let value = Number(raw);
  if (!Number.isFinite(value)) {
    return void 0;
  }
  if (value >= 0 && value <= 1) {
    value *= 100;
  } else if (value > 100 && value <= 1e4) {
    value /= 100;
  }
  if (value < 0 || value > 100) {
    return void 0;
  }
  return Math.round(value);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  aggregateSolarbankSoc,
  normalizeSocPercent
});
//# sourceMappingURL=combinerSoc.js.map
