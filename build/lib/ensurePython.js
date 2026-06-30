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
exports.runPythonInstaller = runPythonInstaller;
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const spawnEnv_1 = require("./spawnEnv");
function adapterRoot() {
    return path.join(__dirname, "..", "..");
}
function runPythonInstaller(pythonPath, log) {
    return new Promise(resolve => {
        const script = path.join(adapterRoot(), "tools", "install-python.js");
        if (!fs.existsSync(script)) {
            resolve({ ok: false, message: `Installer not found: ${script}` });
            return;
        }
        const args = ["--python", pythonPath || ""];
        const proc = (0, node_child_process_1.spawn)(process.execPath, [script, ...args], {
            cwd: adapterRoot(),
            env: (0, spawnEnv_1.minimalSpawnEnv)(),
            windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (c) => {
            stdout += c.toString();
        });
        proc.stderr.on("data", (c) => {
            stderr += c.toString();
        });
        proc.on("close", code => {
            const text = (stdout + stderr).trim();
            if (text) {
                log?.info?.(text);
            }
            resolve({
                ok: code === 0,
                message: code === 0 ? "Python dependencies OK" : text || `Installer exit ${code}`,
            });
        });
        proc.on("error", err => {
            resolve({ ok: false, message: err.message });
        });
    });
}
//# sourceMappingURL=ensurePython.js.map