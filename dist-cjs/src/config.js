"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveConfig = resolveConfig;
exports.getConfigValue = getConfigValue;
exports.setConfigValue = setConfigValue;
exports.resetConfig = resetConfig;
exports.getDefaults = getDefaults;
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
const DEFAULTS = {
    'default-timeout': 10000,
    'screenshot-dir': '/tmp/agent-computer',
    'screenshot-format': 'png',
    retina: false,
    'content-boundary': false,
    'daemon-idle-timeout': 300000,
};
const CONFIG_DIR = (0, path_1.join)((0, os_1.homedir)(), '.config', 'agent-computer');
const CONFIG_FILE = (0, path_1.join)(CONFIG_DIR, 'config.json');
// Environment variable overrides
const ENV_MAP = {
    AC_TIMEOUT: 'default-timeout',
    AC_SCREENSHOT_DIR: 'screenshot-dir',
};
function loadConfigFile() {
    try {
        const raw = (0, fs_1.readFileSync)(CONFIG_FILE, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
function loadEnvOverrides() {
    const overrides = {};
    for (const [envVar, configKey] of Object.entries(ENV_MAP)) {
        const val = process.env[envVar];
        if (val !== undefined) {
            if (configKey) {
                if (configKey === 'default-timeout' || configKey === 'daemon-idle-timeout') {
                    overrides[configKey] = parseInt(val, 10);
                }
                else {
                    overrides[configKey] = val;
                }
            }
        }
    }
    // Boolean env vars
    if (process.env.AC_JSON === '1') {
        // This is handled at the CLI level, not config
    }
    if (process.env.AC_VERBOSE === '1') {
        // This is handled at the CLI level, not config
    }
    return overrides;
}
function resolveConfig() {
    const fileConfig = loadConfigFile();
    const envConfig = loadEnvOverrides();
    return { ...DEFAULTS, ...fileConfig, ...envConfig };
}
function getConfigValue(key) {
    return resolveConfig()[key];
}
function setConfigValue(key, value) {
    const existing = loadConfigFile();
    existing[key] = value;
    (0, fs_1.mkdirSync)(CONFIG_DIR, { recursive: true });
    (0, fs_1.writeFileSync)(CONFIG_FILE, JSON.stringify(existing, null, 2) + '\n');
}
function resetConfig() {
    (0, fs_1.mkdirSync)(CONFIG_DIR, { recursive: true });
    (0, fs_1.writeFileSync)(CONFIG_FILE, JSON.stringify({}, null, 2) + '\n');
}
function getDefaults() {
    return { ...DEFAULTS };
}
