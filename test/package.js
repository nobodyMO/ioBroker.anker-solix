const path = require("path");
const { tests } = require("@iobroker/testing");

// Validate the package files
tests.packageFiles(path.join(__dirname, ".."));

// ioBroker adapter-check / repository rules (news count, npm versions, README version, admin schema)
require("./io-package-policy");

// Python install profile detection (tools/pythonInstallEnv.js)
require("./python-install-env");

// Windows py -3.12 / py -3.13 resolution (tools/pythonCommand.js)
require("./python-command");
