// Safari has no headless mode, and Karma 0.13 has no working Safari launcher. With no browsers to launch,
// Karma runs the suite once in any browser that opens its URL, then exits; test-safari.sh opens Safari.
var baseConfig = require('./karma.conf.js');

module.exports = function (config) {
    baseConfig(config);
    config.set({
        browsers: [],
        singleRun: true,
        autoWatch: false
    });
};
