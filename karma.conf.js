module.exports = function (config) {
    config.set({
        basePath: '',
        frameworks: ['mocha', 'chai'],
        concurrency: 1,

        files: [{
                pattern: 'spec/resources/**/*',
                included: false,
                served: true
            }, {
                pattern: 'node_modules/font-awesome/fonts/*.*',
                included: false,
                served: true
            }, {
                pattern: 'node_modules/font-awesome/css/*.*',
                included: false,
                served: true
            },

            'node_modules/jquery/dist/jquery.js',
            'node_modules/imagediff/imagediff.js',
            'test-lib/tesseract-1.0.10.js',

            'src/dom-to-image.js',
            'spec/dom-to-image.spec.js'
        ],

        exclude: [],
        preprocessors: {},
        reporters: ['mocha'],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        client: {
            captureConsole: true
        },
        autoWatch: true,
        browsers: ['chromeHeadless', 'FirefoxHeadless'],
        customLaunchers: {
            chromeHeadless: {
                base: 'Chrome',
                flags: ['--headless=new', '--no-sandbox', '--disable-gpu']
            }
        },

        singleRun: false,
        browserNoActivityTimeout: 60000
    });
};
