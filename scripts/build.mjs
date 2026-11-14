// Minifies src/dom-to-image.js into dist/dom-to-image.min.js. The first line is a banner with the build date;
// CI compares the file from the second line on.
import { readFileSync, writeFileSync } from 'node:fs';
import { minify } from 'terser';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const source = readFileSync('src/dom-to-image.js', 'utf8');

const now = new Date();
const day = String(now.getDate()).padStart(2, '0');
const month = String(now.getMonth() + 1).padStart(2, '0');
const banner = `/*! ${pkg.name} ${day}-${month}-${now.getFullYear()} */`;

const result = await minify(source, {
    compress: true,
    mangle: true,
    format: { preamble: banner }
});
writeFileSync('dist/dom-to-image.min.js', result.code + '\n');
