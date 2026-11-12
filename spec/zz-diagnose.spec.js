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
        try {
            var pc = document.createElement('canvas'); pc.width = 20; pc.height = 10; var px = pc.getContext('2d');
            info.context = String(px);
            px.fillStyle = 'red'; px.fillRect(0, 0, 20, 10);
            info.plainCanvas = Array.prototype.join.call(px.getImageData(5, 5, 1, 1).data, ',') + ' dataUrl ' + pc.toDataURL().length;
        } catch (e) { info.plainCanvas = 'throws ' + e; }
        try { var wc = document.createElement('canvas').getContext('webgl'); info.webgl = String(wc); } catch (e) { info.webgl = 'throws ' + e; }
        function load(src, name) {
            return new Promise(function (resolve) {
                var img = new Image(); var t = setTimeout(function () { info[name] = 'no event after 5s'; resolve(); }, 5000);
                img.onload = function () { clearTimeout(t); try { var c = document.createElement('canvas'); c.width = 20; c.height = 10;
                    var x = c.getContext('2d'); x.drawImage(img, 0, 0); var p = x.getImageData(5, 5, 1, 1).data;
                    info[name] = 'load ' + img.width + 'x' + img.height + ' pixel ' + Array.prototype.join.call(p, ','); } catch (e) { info[name] = 'load ' + img.width + 'x' + img.height + ', canvas throws ' + e; } resolve(); };
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
