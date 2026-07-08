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
var spawnEnv_exports = {};
__export(spawnEnv_exports, {
  minimalSpawnEnv: () => minimalSpawnEnv
});
module.exports = __toCommonJS(spawnEnv_exports);
var import_node_process = require("node:process");
function minimalSpawnEnv(extra) {
  var _a;
  const result = { ...extra };
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const pathVal = (_a = import_node_process.env[pathKey]) != null ? _a : import_node_process.env.PATH;
  if (pathVal) {
    result[pathKey] = pathVal;
  }
  if (process.platform === "win32" && import_node_process.env.SYSTEMROOT) {
    result.SYSTEMROOT = import_node_process.env.SYSTEMROOT;
  }
  if (import_node_process.env.HOME) {
    result.HOME = import_node_process.env.HOME;
  }
  if (import_node_process.env.USERPROFILE) {
    result.USERPROFILE = import_node_process.env.USERPROFILE;
  }
  return result;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  minimalSpawnEnv
});
//# sourceMappingURL=spawnEnv.js.map
