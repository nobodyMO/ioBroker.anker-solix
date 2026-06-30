"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.adapterRoot = adapterRoot;
exports.venvPythonPath = venvPythonPath;
exports.sitePackagesPath = sitePackagesPath;
exports.hasSitePackagesDeps = hasSitePackagesDeps;
exports.resolvePythonSpawn = resolvePythonSpawn;
exports.resolvePythonExecutable = resolvePythonExecutable;
exports.isPyLauncher = isPyLauncher;
exports.pythonSpawnArgs = pythonSpawnArgs;
exports.buildPythonEnv = buildPythonEnv;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const pythonCommand_1 = require("./pythonCommand");
const spawnEnv_1 = require("./spawnEnv");
/** Adapter package root (contains python/, build/, tools/). */
function adapterRoot() {
    return path.join(__dirname, "..", "..");
}
function venvPythonPath() {
    const venv = path.join(adapterRoot(), "python", ".venv");
    const py = process.platform === "win32" ? path.join(venv, "Scripts", "python.exe") : path.join(venv, "bin", "python3");
    return fs.existsSync(py) ? py : null;
}
function sitePackagesPath() {
    return path.join(adapterRoot(), "python", "site-packages");
}
function hasSitePackagesDeps() {
    return fs.existsSync(path.join(sitePackagesPath(), "aiohttp"));
}
function venvSpawnSpec() {
    const venv = venvPythonPath();
    if (!venv) {
        return null;
    }
    return { cmd: venv, prefix: [], label: venv };
}
/** Prefer configured path, then adapter venv, then auto-detected system Python (Windows: py -3.12+). */
function resolvePythonSpawn(configPath) {
    if (configPath?.trim()) {
        const custom = (0, pythonCommand_1.resolvePythonCommand)(configPath.trim(), adapterRoot());
        if (custom) {
            return custom;
        }
        return { cmd: configPath.trim(), prefix: [], label: configPath.trim() };
    }
    const venv = venvSpawnSpec();
    if (venv) {
        return venv;
    }
    const system = (0, pythonCommand_1.resolvePythonCommand)(undefined, adapterRoot());
    if (system) {
        return system;
    }
    if (process.platform === "win32") {
        return { cmd: "py", prefix: ["-3.12"], label: "py -3.12" };
    }
    return { cmd: "python3", prefix: [], label: "python3" };
}
/** @deprecated Use resolvePythonSpawn + prefix in spawn args */
function resolvePythonExecutable(configPath) {
    return resolvePythonSpawn(configPath).cmd;
}
function isPyLauncher(python) {
    return python === "py";
}
/** Build argv for spawn(exe, args) from spawn spec and script arguments. */
function pythonSpawnArgs(spec, scriptArgs) {
    return [...spec.prefix, ...scriptArgs];
}
/** Env for Python child processes (PYTHONPATH for site-packages fallback). */
function buildPythonEnv() {
    const extra = {
        PYTHONIOENCODING: "utf-8",
    };
    if (hasSitePackagesDeps()) {
        const site = sitePackagesPath();
        extra.PYTHONPATH = site;
    }
    return (0, spawnEnv_1.minimalSpawnEnv)(extra);
}
//# sourceMappingURL=pythonPaths.js.map