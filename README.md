# DOM to Image

[![npm](https://img.shields.io/npm/v/@iqdoq/dom-to-image)](https://www.npmjs.com/package/@iqdoq/dom-to-image)

## What is it

**dom-to-image** is a library which can turn arbitrary DOM node into
a vector (SVG) or raster (PNG or JPEG) image, written in JavaScript. It's
based on [domvas by Paul Bakaus](https://github.com/pbakaus/domvas)
and has been completely rewritten, with some bugs fixed and some new
features (like web font and image support) added.

**This is a fork** of the original [dom-to-image repo of tsayen](https://github.com/tsayen/dom-to-image).
This fork contains the following enhancements and fixes:
* [feature] Add _useCredentials_ option to send authentication credentials for CORS HTTP requests to external (image, font, etc.) URIs that need (existing) authentication data sent with the HTTP request. ([#255][i255])
* [feature] Add scale factor option for png and jpeg output. ([#69][i69], [#172][p172]) 
* [feature] Add _yieldInterval_ and _shouldAbort_ options: cloning yields to the browser in pieces and can be aborted, instead of blocking the page for the whole clone. ([#1][f1])
* [feature] Add _fetchTimeout_ option for loading fonts and images, instead of a fixed 30 s. ([#2][f2])
* [performance] Loaded fonts and images are cached per URL, and inlined web font rules are resolved only once. ([#3][f3])
* [performance] CSS custom properties (`--*`) are no longer copied into the clone; the computed values have resolved `var()` already. ([#4][f4])
* [performance] Only the web fonts the clone uses are embedded: the `@font-face` rules the browser would select for the family, weight and style of each cloned element and pseudo-element. ([#18][f18])
* [performance] Below the root, the clone gets only the style properties that differ from what it gets anyway from the user agent style sheet and by inheritance, which makes the SVG several times smaller. ([#28][f28], [#50][f50], [#51][f51])
* [fix] _imagePlaceholder_, _cacheBust_ and _useCredentials_ apply only to the call that passes them, so overlapping calls no longer change each other's options. `domtoimage.impl.options` is gone. ([#19][f19])

[i255]: https://github.com/tsayen/dom-to-image/issues/255
[i69]: https://github.com/tsayen/dom-to-image/issues/69
[p172]: https://github.com/tsayen/dom-to-image/pull/172
[f1]: https://github.com/iqdoq/dom-to-image/issues/1
[f2]: https://github.com/iqdoq/dom-to-image/issues/2
[f3]: https://github.com/iqdoq/dom-to-image/issues/3
[f4]: https://github.com/iqdoq/dom-to-image/issues/4
[f18]: https://github.com/iqdoq/dom-to-image/issues/18
[f19]: https://github.com/iqdoq/dom-to-image/issues/19
[f28]: https://github.com/iqdoq/dom-to-image/issues/28
[f50]: https://github.com/iqdoq/dom-to-image/issues/50
[f51]: https://github.com/iqdoq/dom-to-image/issues/51

## Installation

### NPM

`npm install @iqdoq/dom-to-image`

Then load

```javascript
/* in ES 6 */
import domtoimage from '@iqdoq/dom-to-image';
/* in ES 5 */
var domtoimage = require('@iqdoq/dom-to-image');
```

### Script tag

Include either `src/dom-to-image.js` or `dist/dom-to-image.min.js` from the npm package in your page
and it will make the `domtoimage` variable available in the global scope.

```html
<script src="path/to/dom-to-image.min.js"></script>
<script>
  domtoimage.toPng(node)
  //...
</script>
```

## Usage

All the top level functions accept DOM node and rendering options,
and return promises, which are fulfilled with corresponding data URLs.  
Get a PNG image base64-encoded data URL and display right away:

```javascript
var node = document.getElementById('my-node');

domtoimage.toPng(node)
    .then(function (dataUrl) {
        var img = new Image();
        img.src = dataUrl;
        document.body.appendChild(img);
    })
    .catch(function (error) {
        console.error('oops, something went wrong!', error);
    });
```

Get a PNG image blob and download it (using [FileSaver](https://github.com/eligrey/FileSaver.js/),
for example):

```javascript
domtoimage.toBlob(document.getElementById('my-node'))
    .then(function (blob) {
        window.saveAs(blob, 'my-node.png');
    });
```

Save and download a compressed JPEG image:

```javascript
domtoimage.toJpeg(document.getElementById('my-node'), { quality: 0.95 })
    .then(function (dataUrl) {
        var link = document.createElement('a');
        link.download = 'my-image-name.jpeg';
        link.href = dataUrl;
        link.click();
    });
```

Get an SVG data URL, but filter out all the `<i>` elements:

```javascript
function filter (node) {
    return (node.tagName !== 'i');
}

domtoimage.toSvg(document.getElementById('my-node'), {filter: filter})
    .then(function (dataUrl) {
        /* do something */
    });
```

Get the raw pixel data as a [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)
with every 4 array elements representing the RGBA data of a pixel:

```javascript
var node = document.getElementById('my-node');

domtoimage.toPixelData(node)
    .then(function (pixels) {
        for (var y = 0; y < node.scrollHeight; ++y) {
          for (var x = 0; x < node.scrollWidth; ++x) {
            pixelAtXYOffset = (4 * y * node.scrollWidth) + (4 * x);
            /* pixelAtXY is a Uint8Array[4] containing RGBA values of the pixel at (x, y) in the range 0..255 */
            pixelAtXY = pixels.slice(pixelAtXYOffset, pixelAtXYOffset + 4);
          }
        }
    });
```

* * *

_All the functions under `impl` are not public API and are exposed only
for unit testing._

* * *

### Rendering options

#### filter

A function taking DOM node as argument. Should return true if passed node
should be included in the output (excluding node means excluding it's
children as well). Not called on the root node.

#### bgcolor

A string value for the background color, any valid CSS color value.

#### height, width

Height and width in pixels to be applied to node before rendering.

#### style

An object whose properties to be copied to node's style before rendering.
You might want to check [this reference](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Properties_Reference)
for JavaScript names of CSS properties.

#### quality

A number between 0 and 1 indicating image quality (e.g. 0.92 => 92%) of the
JPEG image. Defaults to 1.0 (100%)

#### scale

A scale factor for PNG, JPEG and pixel data output, e.g. 2 for a sharp image on a high-density display. The canvas
is that many times larger than the node. Defaults to no scaling.

#### cacheBust

Set to true to append the current time as a query string to URL requests to enable cache busting. Such requests also
bypass the cache of loaded fonts and images. Defaults to false

#### imagePlaceholder

A data URL for a placeholder image that will be used when fetching an image fails. Defaults to undefined and will throw an error on failed images

#### useCredentials

Set to true to send the credentials the browser holds (cookies, HTTP authentication) with the requests for fonts and
images, also to other origins (CORS with credentials). Defaults to false.

Like every option, _cacheBust_, _imagePlaceholder_ and _useCredentials_ apply only to the call that passes them.

#### fetchTimeout

Milliseconds after which loading a font or an image gives up. Defaults to 30000.
A resource still loading for another call is shared, with the timeout of that call.

#### yieldInterval

Milliseconds of cloning after which the library hands control back to the browser
(with a macrotask) before it clones the next child node, so input and rendering are
not blocked for the whole clone. Defaults to 0, which never yields.

#### shouldAbort

A function called after each yield and before fonts and images are loaded. When it
returns true, the returned promise is rejected with an `Error` whose `name` is
`'AbortError'`.

```javascript
var aborted = false;
domtoimage.toPng(node, {
    yieldInterval: 16,
    shouldAbort: function () { return aborted; }
}).catch(function (error) {
    if (error.name !== 'AbortError') throw error;
});
```

## Browsers

The test suite runs on every pull request in current Chromium, Firefox and WebKit, and before a release also in
Safari on macOS.

_Internet Explorer is not (and will not be) supported, as it does not support
SVG `<foreignObject>` tag_

## Dependencies

### Source

Only standard lib is currently used, but make sure your browser supports:  

-   [Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)  
-   SVG `<foreignObject>` tag

### Tests

The tests run in real browsers with [Web Test Runner](https://modern-web.dev/docs/test-runner/overview/);
[CONTRIBUTING.md](CONTRIBUTING.md) explains how. Most importantly, they depend on:

-   [js-imagediff](https://github.com/HumbleSoftware/js-imagediff),
    to compare rendered and control images

-   [Tesseract.js](https://github.com/naptha/tesseract.js), for the
    parts when you can't compare images (due to the browser
    rendering differences) and just have to test whether the text is rendered

## How it works

There might some day exist (or maybe already exists?) a simple and standard
way of exporting parts of the HTML to image (and then this script can only
serve as an evidence of all the hoops I had to jump through in order to get
such obvious thing done) but I haven't found one so far.  

This library uses a feature of SVG that allows having arbitrary HTML content
inside of the `<foreignObject>` tag. So, in order to render that DOM node
for you, following steps are taken:  

1.  Clone the original DOM node recursively

    -   with _yieldInterval_ set, hand control back to the browser between
        child nodes, and stop with an `AbortError` when _shouldAbort_ says so

2.  Compute the style for the node and each sub-node and copy it to
    corresponding clone

    -   the root gets every property; below it, only the properties that
        differ from the element's default and from its parent's value, and
        never custom properties (`--*`)

    -   and don't forget to recreate pseudo-elements, as they are not
        cloned in any way, of course

3.  Embed web fonts

    -   find the `@font-face` declarations the browser would select for the
        family, weight and style of each cloned element

    -   parse file URLs, download corresponding files (each URL only once
        per page)

    -   base64-encode and inline content as `data:` URLs

    -   concatenate all the processed CSS rules and put them into one `<style>`
        element, then attach it to the clone

4.  Embed images

    -   embed image URLs in `<img>` elements

    -   inline images used in `background` CSS property, in a fashion similar to
        fonts

5.  Serialize the cloned node to XML

6.  Wrap XML into the `<foreignObject>` tag, then into the SVG, then make it a
    data URL

7.  Optionally, to get PNG content or raw pixel data as a Uint8Array, create an
    Image element with the SVG as a source, and render it on an off-screen
    canvas, that you have also created, then read the content from the canvas

8.  Done!  

## Things to watch out for

-   if the DOM node you want to render includes a `<canvas>` element with
    something drawn on it, it should be handled fine, unless the canvas is
    [tainted](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image) -
    in this case rendering will rather not succeed.  

-   browsers do not let a page read the rules of a stylesheet from another
    origin that was loaded without CORS. Web fonts declared there cannot be
    embedded; the error is caught and logged, and the rendering goes on
    without them.  

## Authors

[IQDoQ GmbH](https://www.iqdoq.com), Anatolii Saienko (original dom-to-image), Paul Bakaus (original idea)

## License

MIT
