const path = require("path");
const { tests } = require("@iobroker/testing");

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, ".."), {
	// Adapter exits during startup when instance config is missing (default ioBroker behavior)
	allowedExitCodes: [11],
	// "dev" reinstalls js-controller on every run (slow/flaky on Windows CI); use published controller
	controllerVersion: "latest",
});
