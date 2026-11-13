// Runs spec/dom-to-image.spec.js in headless Chromium, Firefox and WebKit through Playwright.
// BROWSERS=chromium,webkit limits the run to some of them; BROWSERS=safari drives Safari through a running
// safaridriver (see test-safari.sh).
import { playwrightLauncher } from '@web/test-runner-playwright';
import { webdriverLauncher } from '@web/test-runner-webdriver';

const ALL_BROWSERS = ['chromium', 'firefox', 'webkit'];
const browserNames = process.env.BROWSERS ? process.env.BROWSERS.split(',') : ALL_BROWSERS;
const SAFARIDRIVER_PORT = Number(process.env.SAFARIDRIVER_PORT || 4444);

function launcher(name) {
    if (name !== 'safari') return playwrightLauncher({ product: name });

    return webdriverLauncher({
        automationProtocol: 'webdriver',
        hostname: '127.0.0.1',
        port: SAFARIDRIVER_PORT,
        capabilities: { browserName: 'safari' }
    });
}

// The specs and their test pages address files below /base/, as Karma served them; serve them from the root.
function stripBasePrefix(context, next) {
    if (context.url.startsWith('/base/')) context.url = context.url.substring('/base'.length);
    return next();
}

export default {
    files: ['spec/dom-to-image.spec.js'],
    nodeResolve: false,
    middleware: [stripBasePrefix],
    browsers: browserNames.map(launcher),
    // the libraries are plain scripts that set globals, as the specs expect them
    testRunnerHtml: testFramework => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
    <script src="/node_modules/chai/chai.js"></script>
    <script src="/node_modules/jquery/dist/jquery.js"></script>
    <script src="/node_modules/imagediff/imagediff.js"></script>
    <script src="/test-lib/tesseract-1.0.10.js"></script>
    <script src="/src/dom-to-image.js"></script>
    <script type="module" src="${testFramework}"></script>
</body>
</html>`,
    testsFinishTimeout: 300000
};
