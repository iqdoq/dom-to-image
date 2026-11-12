// TEMPORARY diagnostics for the CI Safari job, removed before merging
describe('zz diagnose', function () {
    it('reports the environment', function (done) {
        this.timeout(20000);
        var info = {
            visibility: document.visibilityState, hidden: document.hidden, focus: document.hasFocus(),
            inner: window.innerWidth + 'x' + window.innerHeight, dpr: window.devicePixelRatio,
            topInner: window.top.innerWidth + 'x' + window.top.innerHeight, ua: navigator.userAgent
        };
        var div = document.createElement('div'); div.style.width = '100px'; div.style.height = '50px';
        document.body.appendChild(div);
        info.div = div.scrollWidth + 'x' + div.scrollHeight + ' offset ' + div.offsetWidth + 'x' + div.offsetHeight;
        var svg = 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="red"/></svg>';
        var fo = 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="background:red;width:20px;height:10px"></div></foreignObject></svg>';
        function load(src, name) {
            return new Promise(function (resolve) {
                var img = new Image(); var t = setTimeout(function () { info[name] = 'no event after 5s'; resolve(); }, 5000);
                img.onload = function () { clearTimeout(t); var c = document.createElement('canvas'); c.width = 20; c.height = 10;
                    var x = c.getContext('2d'); x.drawImage(img, 0, 0); var p = x.getImageData(5, 5, 1, 1).data;
                    info[name] = 'load ' + img.width + 'x' + img.height + ' pixel ' + Array.prototype.join.call(p, ','); resolve(); };
                img.onerror = function () { clearTimeout(t); info[name] = 'error'; resolve(); };
                img.src = src;
            });
        }
        load(svg, 'svgImage').then(function () { return load(fo, 'foreignObjectImage'); }).then(function () {
            return domtoimage.toPng(div).then(function (png) { info.toPng = png.slice(0, 40) + '... length ' + png.length; },
                function (e) { info.toPng = 'rejected ' + e; });
        }).then(function () {
            console.log('DIAGNOSE ' + JSON.stringify(info));
            div.remove();
        }).then(done, done);
    });
});
