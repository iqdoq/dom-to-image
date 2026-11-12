// Configuration for continuous integration: headless Chrome and Firefox, a single run.
var baseConfig = require('./karma.conf.js');

module.exports = function (config) {
    baseConfig(config);
    config.set({
        singleRun: true,
        autoWatch: false
    });
};
