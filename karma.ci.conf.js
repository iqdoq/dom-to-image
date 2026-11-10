// Configuration for continuous integration: headless Chrome only, a single run.
var baseConfig = require('./karma.conf.js');

module.exports = function (config) {
    baseConfig(config);
    config.set({
        browsers: ['chromeHeadless'],
        customLaunchers: {
            chromeHeadless: {
                base: 'Chrome',
                flags: ['--headless=new', '--no-sandbox', '--disable-gpu']
            }
        },
        singleRun: true,
        autoWatch: false
    });
};
