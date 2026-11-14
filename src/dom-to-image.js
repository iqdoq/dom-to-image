(function (global) {
    'use strict';

    var util = newUtil();
    var inliner = newInliner();
    var fontFaces = newFontFaces();
    var images = newImages();
    var defaultStyles = newDefaultStyles();

    var DEFAULT_FETCH_TIMEOUT = 30000;
    // base64 characters of loaded fonts and images kept across calls, about 20 MB of memory
    var FETCH_CACHE_MAX_CHARS = 10 * 1024 * 1024;
    var fetchCache = new Map();
    var fetchCacheSize = 0;

    var domtoimage = {
        toSvg: toSvg,
        toPng: toPng,
        toJpeg: toJpeg,
        toBlob: toBlob,
        toPixelData: toPixelData,
        impl: {
            fontFaces: fontFaces,
            images: images,
            defaultStyles: defaultStyles,
            util: util,
            inliner: inliner
        }
    };

    if (typeof module !== 'undefined')
        module.exports = domtoimage;
    else
        global.domtoimage = domtoimage;


    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options
     * @param {Function} options.filter - Should return true if passed node should be included in the output
     *          (excluding node means excluding it's children as well). Not called on the root node.
     * @param {String} options.bgcolor - color for the background, any valid CSS color value.
     * @param {Number} options.width - width to be applied to node before rendering.
     * @param {Number} options.height - height to be applied to node before rendering.
     * @param {Object} options.style - an object whose properties to be copied to node's style before rendering.
     * @param {Number} options.quality - a Number between 0 and 1 indicating image quality (applicable to JPEG only),
                defaults to 1.0.
     * @param {Number} options.scale - scale factor for image quality rendering (to unblurry JPEG and PNG output),
                default = unset = no scaling applied = 1.0.
     * @param {String} options.imagePlaceholder - dataURL to use as a placeholder for failed images, default behaviour is to fail fast on images we can't fetch
     * @param {Boolean} options.cacheBust - set to true to cache bust by appending the time to the request url
     * @param {Boolean} options.useCredentials - set to true to send (existing) authentication credentials to external URIs (CORS requests)
     * @param {Number} options.yieldInterval - ms of cloning after which the browser gets a macrotask to handle input
     *          and render, default 0 = never yield (the whole clone runs in one task).
     * @param {Function} options.shouldAbort - called after each yield and before fonts and images are loaded; when it
     *          returns true, the promise is rejected with an Error whose name is 'AbortError'.
     * @param {Number} options.fetchTimeout - ms after which loading a font or an image gives up, default 30000.
     * @return {Promise} - A promise that is fulfilled with a SVG image data URL
     * */
    function toSvg(node, options) {
        options = options || {};
        // the options travel per call in the context: renders yield to the browser and may overlap
        var context = newRenderContext(options);
        return Promise.resolve(node)
            .then(function (node) {
                return cloneNode(node, options.filter, true, context);
            })
            .then(function (clone) {
                checkAbort(context);
                return embedFonts(clone, context);
            })
            .then(function (clone) {
                checkAbort(context);
                return inlineImages(clone, context);
            })
            .then(applyOptions)
            .then(function (clone) {
                return makeSvgDataUri(clone,
                    options.width || util.width(node),
                    options.height || util.height(node)
                );
            });

        function applyOptions(clone) {
            if (options.bgcolor) clone.style.backgroundColor = options.bgcolor;

            if (options.width) clone.style.width = options.width + 'px';
            if (options.height) clone.style.height = options.height + 'px';

            if (options.style)
                Object.keys(options.style).forEach(function (property) {
                    clone.style[property] = options.style[property];
                });

            return clone;
        }
    }

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options, @see {@link toSvg}
     * @return {Promise} - A promise that is fulfilled with a Uint8Array containing RGBA pixel data.
     * */
    function toPixelData(node, options) {
        return draw(node, options || {})
            .then(function (canvas) {
                return canvas.getContext('2d').getImageData(
                    0,
                    0,
                    util.width(node),
                    util.height(node)
                ).data;
            });
    }

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options, @see {@link toSvg}
     * @return {Promise} - A promise that is fulfilled with a PNG image data URL
     * */
    function toPng(node, options) {
        return draw(node, options || {})
            .then(function (canvas) {
                return canvas.toDataURL();
            });
    }

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options, @see {@link toSvg}
     * @return {Promise} - A promise that is fulfilled with a JPEG image data URL
     * */
    function toJpeg(node, options) {
        options = options || {};
        return draw(node, options)
            .then(function (canvas) {
                return canvas.toDataURL('image/jpeg', options.quality || 1.0);
            });
    }

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options, @see {@link toSvg}
     * @return {Promise} - A promise that is fulfilled with a PNG image blob
     * */
    function toBlob(node, options) {
        return draw(node, options || {})
            .then(util.canvasToBlob);
    }

    function newRenderContext(options) {
        return {
            // without a placeholder, an image that cannot be loaded fails the render
            imagePlaceholder: options.imagePlaceholder,
            cacheBust: options.cacheBust || false,
            useCredentials: options.useCredentials || false,
            yieldInterval: options.yieldInterval || 0,
            shouldAbort: options.shouldAbort || null,
            fetchTimeout: options.fetchTimeout || DEFAULT_FETCH_TIMEOUT,
            // font family -> weights and styles the clone uses, filled while cloning, see fontFaces.recordUse
            usedFonts: new Map(),
            lastYield: performance.now()
        };
    }

    function checkAbort(context) {
        if (!context.shouldAbort) return;
        if (!context.shouldAbort()) return;

        var error = new Error('dom-to-image rendering aborted');
        error.name = 'AbortError';
        throw error;
    }

    function yieldIfDue(context) {
        if (!context.yieldInterval) return;

        var sinceLastYield = performance.now() - context.lastYield;
        if (sinceLastYield < context.yieldInterval) return;

        return util.nextMacrotask()
            .then(function () {
                context.lastYield = performance.now();
                checkAbort(context);
            });
    }

    function draw(domNode, options) {
        return toSvg(domNode, options)
            .then(function (svgDataUri) {
                return util.makeImage(svgDataUri, options.useCredentials);
            })
            .then(util.delay(100))
            .then(function (image) {
                var canvas = newCanvas(domNode);
                var ctx = canvas.getContext('2d');
                if (options.scale) {
                    ctx.scale(options.scale, options.scale);
                }
                ctx.drawImage(image, 0, 0);
                return canvas;
            });

        function newCanvas(domNode) {
            var canvas = document.createElement('canvas');
            if (options.scale) {
                canvas.width = options.width || options.scale * util.width(domNode);
                canvas.height = options.height || options.scale * util.height(domNode);
            }
            else {
                canvas.width = options.width || util.width(domNode);
                canvas.height = options.height || util.height(domNode);
            }

            if (options.bgcolor) {
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = options.bgcolor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            return canvas;
        }
    }

    function cloneNode(node, filter, root, context) {
        if (!root && filter && !filter(node)) return Promise.resolve();

        return Promise.resolve(node)
            .then(makeNodeCopy)
            .then(function (clone) {
                return cloneChildren(node, clone, filter);
            })
            .then(function (clone) {
                return processClone(node, clone);
            });

        function makeNodeCopy(node) {
            if (node instanceof HTMLCanvasElement) return util.makeImage(node.toDataURL());
            return node.cloneNode(false);
        }

        function cloneChildren(original, clone, filter) {
            var children = original.childNodes;
            if (children.length === 0) return Promise.resolve(clone);

            return cloneChildrenInOrder(clone, util.asArray(children), filter)
                .then(function () {
                    return clone;
                });

            function cloneChildrenInOrder(parent, children, filter) {
                var done = Promise.resolve();
                children.forEach(function (child) {
                    done = done
                        .then(function () {
                            return yieldIfDue(context);
                        })
                        .then(function () {
                            return cloneNode(child, filter, false, context);
                        })
                        .then(function (childClone) {
                            if (childClone) parent.appendChild(childClone);
                        });
                });
                return done;
            }
        }

        function processClone(original, clone) {
            if (!(clone instanceof Element)) return clone;

            return Promise.resolve()
                .then(cloneStyle)
                .then(clonePseudoElements)
                .then(copyUserInput)
                .then(fixSvg)
                .then(function () {
                    return clone;
                });

            function cloneStyle() {
                var computedStyle = window.getComputedStyle(original);
                copyStyle(computedStyle, clone.style);
                fontFaces.recordUse(computedStyle, context);

                function copyStyle(source, target) {
                    if (source.cssText) target.cssText = source.cssText;
                    else copyProperties(source, target);

                    // Custom properties (--*) are left out: the computed values have resolved var() already,
                    // and an application with hundreds of them multiplies the size and time of every clone.
                    // Below the root, a property the clone gets anyway is left out as well, see defaultStyles.
                    function copyProperties(source, target) {
                        var redundant = redundancyCheck();

                        util.asArray(source).forEach(function (name) {
                            if (util.isCustomProperty(name)) return;

                            var value = source.getPropertyValue(name);
                            if (redundant(name, value)) return;

                            target.setProperty(name, value, source.getPropertyPriority(name));
                        });
                    }
                }

                // the root takes every property: in the image it has no parent to inherit from
                function redundancyCheck() {
                    var parent = original.parentElement;
                    if (root || !parent) return function () {
                        return false;
                    };

                    return defaultStyles.redundancyCheck(original, null, window.getComputedStyle(parent));
                }
            }

            function clonePseudoElements() {
                [':before', ':after'].forEach(function (element) {
                    clonePseudoElement(element);
                });

                function clonePseudoElement(element) {
                    var style = window.getComputedStyle(original, element);
                    var content = style.getPropertyValue('content');

                    if (content === '' || content === 'none') return;

                    // icon fonts are mostly used by pseudo-elements only
                    fontFaces.recordUse(style, context);

                    var className = util.uid();
                    clone.className = clone.className + ' ' + className;
                    var styleElement = document.createElement('style');
                    styleElement.appendChild(formatPseudoElementStyle(className, element, style));
                    clone.appendChild(styleElement);

                    function formatPseudoElementStyle(className, element, style) {
                        var selector = '.' + className + ':' + element;
                        var cssText = style.cssText ? formatCssText(style) : formatCssProperties(style);
                        return document.createTextNode(selector + '{' + cssText + '}');

                        function formatCssText(style) {
                            var content = style.getPropertyValue('content');
                            return style.cssText + ' content: ' + content + ';';
                        }

                        // a pseudo-element inherits from its element, so the element's style is the parent's
                        function formatCssProperties(style) {
                            var redundant = defaultStyles.redundancyCheck(original, element,
                                window.getComputedStyle(original));

                            return util.asArray(style)
                                .filter(function (name) {
                                    if (util.isCustomProperty(name)) return false;
                                    if (name === 'content') return true;
                                    return !redundant(name, style.getPropertyValue(name));
                                })
                                .map(formatProperty)
                                .join('; ') + ';';

                            function formatProperty(name) {
                                return name + ': ' +
                                    style.getPropertyValue(name) +
                                    (style.getPropertyPriority(name) ? ' !important' : '');
                            }
                        }
                    }
                }
            }

            function copyUserInput() {
                if (original instanceof HTMLTextAreaElement) clone.innerHTML = original.value;
                if (original instanceof HTMLInputElement) clone.setAttribute("value", original.value);
            }

            function fixSvg() {
                if (!(clone instanceof SVGElement)) return;
                clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                if (!(clone instanceof SVGRectElement)) return;
                ['width', 'height'].forEach(function (attribute) {
                    var value = clone.getAttribute(attribute);
                    if (!value) return;

                    clone.style.setProperty(attribute, value);
                });
            }
        }
    }

    function embedFonts(node, context) {
        return fontFaces.resolveAll(context)
            .then(function (cssText) {
                var styleNode = document.createElement('style');
                node.appendChild(styleNode);
                styleNode.appendChild(document.createTextNode(cssText));
                return node;
            });
    }

    function inlineImages(node, context) {
        return images.inlineAll(node, context)
            .then(function () {
                return node;
            });
    }

    function makeSvgDataUri(node, width, height) {
        return Promise.resolve(node)
            .then(function (node) {
                node.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
                return new XMLSerializer().serializeToString(node);
            })
            .then(util.escapeXhtml)
            .then(function (xhtml) {
                return '<foreignObject x="0" y="0" width="100%" height="100%">' + xhtml + '</foreignObject>';
            })
            .then(function (foreignObject) {
                return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
                    foreignObject + '</svg>';
            })
            .then(function (svg) {
                return 'data:image/svg+xml;charset=utf-8,' + svg;
            });
    }

    function newUtil() {
        return {
            escape: escape,
            parseExtension: parseExtension,
            mimeType: mimeType,
            dataAsUrl: dataAsUrl,
            isDataUrl: isDataUrl,
            canvasToBlob: canvasToBlob,
            resolveUrl: resolveUrl,
            getAndEncode: getAndEncode,
            uid: uid(),
            delay: delay,
            nextMacrotask: nextMacrotask,
            isCustomProperty: isCustomProperty,
            asArray: asArray,
            escapeXhtml: escapeXhtml,
            makeImage: makeImage,
            width: width,
            height: height
        };

        function mimes() {
            /*
             * Only WOFF and EOT mime types for fonts are 'real'
             * see http://www.iana.org/assignments/media-types/media-types.xhtml
             */
            var WOFF = 'application/font-woff';
            var JPEG = 'image/jpeg';

            return {
                'woff': WOFF,
                'woff2': WOFF,
                'ttf': 'application/font-truetype',
                'eot': 'application/vnd.ms-fontobject',
                'png': 'image/png',
                'jpg': JPEG,
                'jpeg': JPEG,
                'gif': 'image/gif',
                'tiff': 'image/tiff',
                'svg': 'image/svg+xml'
            };
        }

        function parseExtension(url) {
            var match = /\.([^\.\/]*?)$/g.exec(url);
            if (match) return match[1];
            else return '';
        }

        function mimeType(url) {
            var extension = parseExtension(url).toLowerCase();
            return mimes()[extension] || '';
        }

        function isDataUrl(url) {
            return url.search(/^(data:)/) !== -1;
        }

        function toBlob(canvas) {
            return new Promise(function (resolve) {
                var binaryString = window.atob(canvas.toDataURL().split(',')[1]);
                var length = binaryString.length;
                var binaryArray = new Uint8Array(length);

                for (var i = 0; i < length; i++)
                    binaryArray[i] = binaryString.charCodeAt(i);

                resolve(new Blob([binaryArray], {
                    type: 'image/png'
                }));
            });
        }

        function canvasToBlob(canvas) {
            if (canvas.toBlob)
                return new Promise(function (resolve) {
                    canvas.toBlob(resolve);
                });

            return toBlob(canvas);
        }

        function resolveUrl(url, baseUrl) {
            var doc = document.implementation.createHTMLDocument();
            var base = doc.createElement('base');
            doc.head.appendChild(base);
            var a = doc.createElement('a');
            doc.body.appendChild(a);
            base.href = baseUrl;
            a.href = url;
            return a.href;
        }

        function uid() {
            var index = 0;

            return function () {
                return 'u' + fourRandomChars() + index++;

                function fourRandomChars() {
                    /* see http://stackoverflow.com/a/6248722/2519373 */
                    return ('0000' + (Math.random() * Math.pow(36, 4) << 0).toString(36)).slice(-4);
                }
            };
        }

        function makeImage(uri, useCredentials) {
            return new Promise(function (resolve, reject) {
                var image = new Image();
                if (useCredentials) {
                    image.crossOrigin = 'use-credentials';
                }
                image.onload = function () {
                    resolve(image);
                };
                image.onerror = reject;
                image.src = uri;
            });
        }

        /**
         * @param {String} url - absolute URL of the font or image
         * @param {Object} context - render context of the call, may be omitted for the default options
         * @param {Function} onFailure - called when the resource could not be loaded, may be omitted
         * @return {Promise} - fulfilled with the base64 content, the placeholder or '' when loading failed
         */
        function getAndEncode(url, context, onFailure) {
            context = context || newRenderContext({});

            return fetchCached(url, context)
                .catch(function (error) {
                    if (onFailure) onFailure();

                    var placeholder = placeholderContent(context.imagePlaceholder);
                    if (placeholder) return placeholder;

                    console.error(error.message);
                    return '';
                });
        }

        function placeholderContent(imagePlaceholder) {
            if (!imagePlaceholder) return undefined;

            return imagePlaceholder.split(/,/)[1];
        }

        /*
         * One preview loads the same background image many times, and every preview the same fonts. A request
         * still running is shared, a failed one is dropped so the next call tries again. The cache keeps at most
         * FETCH_CACHE_MAX_CHARS of base64 content, dropping the least recently used entries first.
         */
        function fetchCached(url, context) {
            if (context.cacheBust) {
                // Cache bypass so we dont have CORS issues with cached images
                // Source: https://developer.mozilla.org/en/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest#Bypassing_the_cache
                var bustedUrl = url + ((/\?/).test(url) ? "&" : "?") + (new Date()).getTime();
                return fetchAndEncode(bustedUrl, context);
            }

            var key = (context.useCredentials ? 'credentials ' : '') + url;
            var cached = fetchCache.get(key);
            if (cached) {
                // re-insert to mark it as most recently used
                fetchCache.delete(key);
                fetchCache.set(key, cached);
                return cached.content;
            }

            var entry = {
                size: 0,
                content: null
            };
            entry.content = fetchAndEncode(url, context)
                .then(function (content) {
                    var stillCached = fetchCache.get(key) === entry;
                    if (stillCached) {
                        entry.size = content.length;
                        fetchCacheSize += entry.size;
                        evictFromFetchCache();
                    }
                    return content;
                }, function (error) {
                    if (fetchCache.get(key) === entry) fetchCache.delete(key);
                    throw error;
                });
            fetchCache.set(key, entry);
            return entry.content;
        }

        function evictFromFetchCache() {
            while (fetchCacheSize > FETCH_CACHE_MAX_CHARS) {
                var oldestKey = fetchCache.keys().next().value;
                var oldest = fetchCache.get(oldestKey);
                fetchCache.delete(oldestKey);
                fetchCacheSize -= oldest.size;
            }
        }

        function fetchAndEncode(url, context) {
            var timeout = context.fetchTimeout;

            return new Promise(function (resolve, reject) {
                var request = new XMLHttpRequest();

                request.onreadystatechange = done;
                request.onerror = failed;
                request.ontimeout = timedOut;
                request.responseType = 'blob';
                request.timeout = timeout;
                if (context.useCredentials) {
                    request.withCredentials = true;
                }
                request.open('GET', url, true);
                request.send();

                function done() {
                    if (request.readyState !== 4) return;

                    // a network error and a timeout end with status 0, failed() and timedOut() report them
                    if (request.status === 0) return;

                    if (request.status !== 200) {
                        reject(new Error('cannot fetch resource: ' + url + ', status: ' + request.status));
                        return;
                    }

                    var encoder = new FileReader();
                    encoder.onloadend = function () {
                        var content = encoder.result.split(/,/)[1];
                        resolve(content);
                    };
                    encoder.readAsDataURL(request.response);
                }

                function failed() {
                    reject(new Error('cannot fetch resource: ' + url + ', status: ' + request.status));
                }

                function timedOut() {
                    reject(new Error('timeout of ' + timeout + 'ms occured while fetching resource: ' + url));
                }
            });
        }

        // A message on a fresh channel is a macrotask without the 4 ms clamp of a nested setTimeout
        function nextMacrotask() {
            return new Promise(function (resolve) {
                var channel = new MessageChannel();
                channel.port1.onmessage = function () {
                    channel.port1.close();
                    resolve();
                };
                channel.port2.postMessage(null);
            });
        }

        function isCustomProperty(name) {
            return name.indexOf('--') === 0;
        }

        function dataAsUrl(content, type) {
            return 'data:' + type + ';base64,' + content;
        }

        function escape(string) {
            return string.replace(/([.*+?^${}()|\[\]\/\\])/g, '\\$1');
        }

        function delay(ms) {
            return function (arg) {
                return new Promise(function (resolve) {
                    setTimeout(function () {
                        resolve(arg);
                    }, ms);
                });
            };
        }

        function asArray(arrayLike) {
            var array = [];
            var length = arrayLike.length;
            for (var i = 0; i < length; i++) array.push(arrayLike[i]);
            return array;
        }

        function escapeXhtml(string) {
            return string.replace(/#/g, '%23').replace(/\n/g, '%0A');
        }

        function width(node) {
            var leftBorder = px(node, 'border-left-width');
            var rightBorder = px(node, 'border-right-width');
            return node.scrollWidth + leftBorder + rightBorder;
        }

        function height(node) {
            var topBorder = px(node, 'border-top-width');
            var bottomBorder = px(node, 'border-bottom-width');
            return node.scrollHeight + topBorder + bottomBorder;
        }

        function px(node, styleProperty) {
            var value = window.getComputedStyle(node).getPropertyValue(styleProperty);
            return parseFloat(value.replace('px', ''));
        }
    }

    function newInliner() {
        var URL_REGEX = /url\(['"]?([^'"]+?)['"]?\)/g;

        return {
            inlineAll: inlineAll,
            shouldProcess: shouldProcess,
            impl: {
                readUrls: readUrls,
                inline: inline
            }
        };

        function shouldProcess(string) {
            return string.search(URL_REGEX) !== -1;
        }

        function readUrls(string) {
            var result = [];
            var match;
            while ((match = URL_REGEX.exec(string)) !== null) {
                result.push(match[1]);
            }
            return result.filter(function (url) {
                return !util.isDataUrl(url);
            });
        }

        function inline(string, url, baseUrl, get) {
            return Promise.resolve(url)
                .then(function (url) {
                    return baseUrl ? util.resolveUrl(url, baseUrl) : url;
                })
                .then(get || util.getAndEncode)
                .then(function (data) {
                    return util.dataAsUrl(data, util.mimeType(url));
                })
                .then(function (dataUrl) {
                    return string.replace(urlAsRegex(url), '$1' + dataUrl + '$3');
                });

            function urlAsRegex(url) {
                return new RegExp('(url\\([\'"]?)(' + util.escape(url) + ')([\'"]?\\))', 'g');
            }
        }

        function inlineAll(string, baseUrl, get) {
            if (nothingToInline()) return Promise.resolve(string);

            return Promise.resolve(string)
                .then(readUrls)
                .then(function (urls) {
                    var done = Promise.resolve(string);
                    urls.forEach(function (url) {
                        done = done.then(function (string) {
                            return inline(string, url, baseUrl, get);
                        });
                    });
                    return done;
                });

            function nothingToInline() {
                return !shouldProcess(string);
            }
        }
    }

    function newFontFaces() {
        // inlined CSS text per font rule; the fonts of a page do not change, a stylesheet added later brings new rules
        var resolvedRules = new Map();

        return {
            resolveAll: resolveAll,
            recordUse: recordUse,
            impl: {
                readAll: readAll,
                selectUsed: selectUsed
            }
        };

        /**
         * @param {Object} context - render context of the call; without one, every font of the page is embedded
         * @return {Promise} - fulfilled with the inlined @font-face rules the clone needs
         */
        function resolveAll(context) {
            return readAll(document)
                .then(function (webFonts) {
                    if (!context) return webFonts;
                    return selectUsed(webFonts, context.usedFonts);
                })
                .then(function (webFonts) {
                    return Promise.all(
                        webFonts.map(function (webFont) {
                            return webFont.resolve(context);
                        })
                    );
                })
                .then(function (cssStrings) {
                    return cssStrings.join('\n');
                });
        }

        /*
         * Notes the font families of a computed style, with its weight and style, as used by the clone. Every
         * family of the font-family list counts: which one the browser draws a character with is not known here.
         */
        function recordUse(computedStyle, context) {
            var weight = parseInt(computedStyle.getPropertyValue('font-weight'), 10) || 400;
            var style = styleKind(computedStyle.getPropertyValue('font-style'));
            var variant = weight + ' ' + style;

            parseFamilies(computedStyle.getPropertyValue('font-family')).forEach(function (family) {
                var variants = context.usedFonts.get(family);
                if (!variants) {
                    variants = new Set();
                    context.usedFonts.set(family, variants);
                }
                variants.add(variant);
            });
        }

        /*
         * Keeps the font faces the browser would choose for the used families, weights and styles, following the
         * font matching of CSS Fonts: style first, then the nearest weight. All faces with the chosen descriptors
         * are kept, so a font split by unicode-range stays complete. A face whose weight cannot be read is kept.
         */
        function selectUsed(webFonts, usedFonts) {
            var selected = new Set();

            webFonts.forEach(function (webFont) {
                if (!webFont.weightRange()) selected.add(webFont);
            });

            usedFonts.forEach(function (variants, family) {
                var faces = webFonts.filter(function (webFont) {
                    return webFont.family() === family && webFont.weightRange();
                });
                if (faces.length === 0) return;

                variants.forEach(function (variant) {
                    var parts = variant.split(' ');
                    var weight = parseInt(parts[0], 10);
                    var style = parts[1];

                    var facesOfStyle = matchStyle(faces, style);
                    var range = matchWeight(facesOfStyle, weight);
                    facesOfStyle.forEach(function (webFont) {
                        var faceRange = webFont.weightRange();
                        if (faceRange[0] === range[0] && faceRange[1] === range[1]) selected.add(webFont);
                    });
                });
            });

            return webFonts.filter(function (webFont) {
                return selected.has(webFont);
            });

            function matchStyle(faces, style) {
                var order = {
                    italic: ['italic', 'oblique', 'normal'],
                    oblique: ['oblique', 'italic', 'normal'],
                    normal: ['normal', 'oblique', 'italic']
                }[style];

                for (var i = 0; i < order.length; i++) {
                    var facesOfStyle = faces.filter(hasStyle(order[i]));
                    if (facesOfStyle.length > 0) return facesOfStyle;
                }
                return faces;

                function hasStyle(kind) {
                    return function (webFont) {
                        return webFont.style() === kind;
                    };
                }
            }

            // returns the weight range of the face to use for the desired weight
            function matchWeight(faces, weight) {
                var ranges = faces.map(function (webFont) {
                    return webFont.weightRange();
                });

                var containing = ranges.filter(function (range) {
                    return range[0] <= weight && weight <= range[1];
                });
                if (containing.length > 0) return containing[0];

                var heavier = ranges.filter(function (range) {
                    return range[0] > weight;
                }).sort(function (a, b) {
                    return a[0] - b[0];
                });
                var lighter = ranges.filter(function (range) {
                    return range[1] < weight;
                }).sort(function (a, b) {
                    return b[1] - a[1];
                });

                if (weight >= 400 && weight <= 500) {
                    var heavierUpTo500 = heavier.filter(function (range) {
                        return range[0] <= 500;
                    });
                    if (heavierUpTo500.length > 0) return heavierUpTo500[0];
                    if (lighter.length > 0) return lighter[0];
                    return heavier[0];
                }
                if (weight < 400) return lighter[0] || heavier[0];
                return heavier[0] || lighter[0];
            }
        }

        function parseFamilies(fontFamily) {
            var families = [];
            var pattern = /"([^"]*)"|'([^']*)'|([^,]+)/g;
            var match;
            while ((match = pattern.exec(fontFamily)) !== null) {
                var family = normalizeFamily(match[1] || match[2] || match[3]);
                if (family) families.push(family);
            }
            return families;
        }

        function normalizeFamily(family) {
            return family.trim().replace(/\s+/g, ' ').toLowerCase();
        }

        // 'oblique 10deg' is oblique
        function styleKind(fontStyle) {
            var kind = fontStyle.trim().split(/\s+/)[0];
            if (kind === 'italic' || kind === 'oblique') return kind;
            return 'normal';
        }

        // [min, max] of a font-weight descriptor, undefined if it cannot be read
        function parseWeightRange(descriptor) {
            var keywords = {
                '': 400,
                normal: 400,
                bold: 700
            };
            var values = descriptor.trim().split(/\s+/).map(function (value) {
                if (value in keywords) return keywords[value];
                return Number(value);
            });
            if (values.length > 2 || values.some(isNaN)) return undefined;

            return [values[0], values[values.length - 1]];
        }

        function readAll() {
            return Promise.resolve(util.asArray(document.styleSheets))
                .then(getCssRules)
                .then(selectWebFontRules)
                .then(function (rules) {
                    return rules.map(newWebFont);
                });

            function selectWebFontRules(cssRules) {
                return cssRules
                    .filter(function (rule) {
                        return rule.type === CSSRule.FONT_FACE_RULE;
                    })
                    .filter(function (rule) {
                        return inliner.shouldProcess(rule.style.getPropertyValue('src'));
                    });
            }

            function getCssRules(styleSheets) {
                var cssRules = [];
                styleSheets.forEach(function (sheet) {
                    try {
                        util.asArray(sheet.cssRules || []).forEach(cssRules.push.bind(cssRules));
                    } catch (e) {
                        console.log('Error while reading CSS rules from ' + sheet.href, e.toString());
                    }
                });
                return cssRules;
            }

            function newWebFont(webFontRule) {
                return {
                    resolve: function resolve(context) {
                        var baseUrl = (webFontRule.parentStyleSheet || {}).href;
                        var key = baseUrl + '\n' + webFontRule.cssText;
                        var cached = resolvedRules.get(key);
                        if (cached) return cached;

                        // a rule with a font that failed to load is not kept, the next call tries again
                        var failed = false;
                        var resolved = inliner.inlineAll(webFontRule.cssText, baseUrl, function (url) {
                            return util.getAndEncode(url, context, function () {
                                failed = true;
                            });
                        })
                            .then(function (cssText) {
                                if (failed) resolvedRules.delete(key);
                                return cssText;
                            });
                        resolvedRules.set(key, resolved);
                        return resolved;
                    },
                    src: function () {
                        return webFontRule.style.getPropertyValue('src');
                    },
                    family: function () {
                        return parseFamilies(webFontRule.style.getPropertyValue('font-family'))[0];
                    },
                    style: function () {
                        return styleKind(webFontRule.style.getPropertyValue('font-style'));
                    },
                    weightRange: function () {
                        return parseWeightRange(webFontRule.style.getPropertyValue('font-weight'));
                    }
                };
            }
        }
    }

    /*
     * The computed style of an element lists every CSS property, about 300 to 500 of them, while only a few differ
     * from what the element gets anyway. Copying them all makes the SVG several MB per preview, and serializing,
     * parsing and rasterizing it grows with that. A property is left out of the clone when its value is the
     * element's default, read in an empty sandbox document from an element of the same tag and the same
     * attributes the UA style sheet selects on, and also the parent's value. Requiring both covers inherited
     * properties, whose default would otherwise hide a different value of the parent, without a list of them.
     */
    function newDefaultStyles() {
        // attributes the UA style sheet selects on, e.g. a[href], input[type], [hidden], [dir]
        var UA_ATTRIBUTES = ['type', 'href', 'hidden', 'dir', 'open', 'multiple', 'size', 'disabled', 'controls',
            'checked', 'selected', 'readonly'];
        // properties the UA style sheet sets by context rather than by tag: nested lists lose their margins and
        // change their marker, a heading in a section gets smaller, table cells take vertical-align from the row
        var ALWAYS_COPIED = new Set(['font-size', 'list-style-type', 'vertical-align',
            'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
            'margin-block-start', 'margin-block-end', 'margin-inline-start', 'margin-inline-end']);

        var sandbox = null;
        // key of tag, attributes and pseudo-element -> Map of property name to default value
        var defaults = new Map();

        return {
            redundancyCheck: redundancyCheck,
            impl: {
                defaultsOf: defaultsOf
            }
        };

        /**
         * @param {Element} element - the original element
         * @param {String} pseudo - ':before', ':after' or null for the element itself
         * @param {CSSStyleDeclaration} parentStyle - computed style of what the clone inherits from
         * @return {Function} - (name, value) => true when the clone gets the value without copying it
         */
        function redundancyCheck(element, pseudo, parentStyle) {
            var elementDefaults = defaultsOf(element, pseudo);

            return function (name, value) {
                if (ALWAYS_COPIED.has(name)) return false;
                if (elementDefaults.get(name) !== value) return false;
                return parentStyle.getPropertyValue(name) === value;
            };
        }

        function defaultsOf(element, pseudo) {
            var key = keyOf(element, pseudo);
            var known = defaults.get(key);
            if (known) return known;

            var sandboxDocument = sandboxDocumentOf();
            var probe = sandboxDocument.createElementNS(element.namespaceURI, element.localName);
            UA_ATTRIBUTES.forEach(function (name) {
                if (element.hasAttribute(name)) probe.setAttribute(name, element.getAttribute(name));
            });
            sandboxDocument.body.appendChild(probe);

            var style = sandboxDocument.defaultView.getComputedStyle(probe, pseudo);
            var values = new Map();
            util.asArray(style).forEach(function (name) {
                values.set(name, style.getPropertyValue(name));
            });
            probe.remove();

            defaults.set(key, values);
            return values;
        }

        function keyOf(element, pseudo) {
            var key = element.namespaceURI + ' ' + element.localName + ' ' + (pseudo || '');
            UA_ATTRIBUTES.forEach(function (name) {
                if (element.hasAttribute(name)) key += ' ' + name + '=' + element.getAttribute(name);
            });
            return key;
        }

        // a hidden iframe in standards mode, like the XHTML of the SVG; created again if the page removed it
        function sandboxDocumentOf() {
            if (sandbox && sandbox.isConnected) return sandbox.contentDocument;

            sandbox = document.createElement('iframe');
            sandbox.setAttribute('aria-hidden', 'true');
            sandbox.tabIndex = -1;
            sandbox.style.cssText = 'position: absolute; left: -10000px; top: 0; width: 0; height: 0; ' +
                'border: 0; visibility: hidden;';
            document.body.appendChild(sandbox);

            var sandboxDocument = sandbox.contentDocument;
            sandboxDocument.open();
            sandboxDocument.write('<!DOCTYPE html><html><head></head><body></body></html>');
            sandboxDocument.close();
            return sandboxDocument;
        }
    }

    function newImages() {
        return {
            inlineAll: inlineAll,
            impl: {
                newImage: newImage
            }
        };

        function newImage(element) {
            return {
                inline: inline
            };

            function inline(get) {
                if (util.isDataUrl(element.src)) return Promise.resolve();

                return Promise.resolve(element.src)
                    .then(get || util.getAndEncode)
                    .then(function (data) {
                        return util.dataAsUrl(data, util.mimeType(element.src));
                    })
                    .then(function (dataUrl) {
                        return new Promise(function (resolve, reject) {
                            element.onload = resolve;
                            element.onerror = reject;
                            element.src = dataUrl;
                        });
                    });
            }
        }

        function inlineAll(node, context) {
            if (!(node instanceof Element)) return Promise.resolve(node);

            return inlineBackground(node)
                .then(function () {
                    if (node instanceof HTMLImageElement)
                        return newImage(node).inline(get);
                    else
                        return Promise.all(
                            util.asArray(node.childNodes).map(function (child) {
                                return inlineAll(child, context);
                            })
                        );
                });

            function get(url) {
                return util.getAndEncode(url, context);
            }

            // the longhand: the shorthand reads empty unless the clone has every background property, and it
            // leaves out those equal to the default
            function inlineBackground(node) {
                var background = node.style.getPropertyValue('background-image');

                if (!background) return Promise.resolve(node);

                return inliner.inlineAll(background, undefined, get)
                    .then(function (inlined) {
                        node.style.setProperty(
                            'background-image',
                            inlined,
                            node.style.getPropertyPriority('background-image')
                        );
                    })
                    .then(function () {
                        return node;
                    });
            }
        }
    }
})(this);
