/**
 * @ignore
 * getScript support for css and js callback after load
 * @author yiminghe@gmail.com
 */
(function (S) {
    var MILLISECONDS_OF_SECOND = 1000,
        doc = S.Env.host.document,
        Utils = S.Loader.Utils,
        Path = S.Path,
        jsCssCallbacks = {},
        headNode,
        UA = S.UA;

    /**
     * Load a javascript/css file from the server using a GET HTTP request,
     * then execute it.
     *
     * for example:
     *      @example
     *      getScript(url, success, charset);
     *      // or
     *      getScript(url, {
     *          charset: string
     *          success: fn,
     *          error: fn,
     *          timeout: number
     *      });
     *
     * Note 404/500 status in ie<9 will trigger success callback.
     * If you want a jsonp operation, please use {@link KISSY.IO} instead.
     *
     * @param {String} url resource's url
     * @param {Function|Object} [success] success callback or config
     * @param {Function} [success.success] success callback
     * @param {Function} [success.error] error callback
     * @param {Number} [success.timeout] timeout (s)
     * @param {String} [success.charset] charset of current resource
     * @param {String} [charset] charset of current resource
     * @return {HTMLElement} script/style node
     * @member KISSY
     */
    S.getScript = function (url, success, charset) {
        // can not use KISSY.Uri, url can not be encoded for some url
        // eg: /??dom.js,event.js , ? , should not be encoded
        var config = success,
            css = 0,
            error,
            timeout,
            attrs,
            callbacks,
            timer;

        if (S.startsWith(Path.extname(url).toLowerCase(), '.css')) {
            css = 1;
        }

        if (S.isPlainObject(config)) {
            success = config['success'];
            error = config['error'];
            timeout = config['timeout'];
            charset = config['charset'];
            attrs = config['attrs'];
        }

        callbacks = jsCssCallbacks[url] = jsCssCallbacks[url] || [];

        callbacks.push([success, error]);

        if (callbacks.length > 1) {
            return callbacks.node;
        }

        var node = doc.createElement(css ? 'link' : 'script'),
            clearTimer = function () {
                if (timer) {
                    timer.cancel();
                    timer = undefined;
                }
            };

        if (attrs) {
            S.each(attrs, function (v, n) {
                node.setAttribute(n, v);
            });
        }

        if (charset) {
            node.charset = charset;
        }

        if (css) {
            node.href = url;
            node.rel = 'stylesheet';
        } else {
            node.src = url;
            node.async = true;
        }

        callbacks.node = node;

        var end = function (error) {
            var index = error,
                fn;
            clearTimer();
            S.each(jsCssCallbacks[url], function (callback) {
                if (fn = callback[index]) {
                    fn.call(node);
                }
            });
            delete jsCssCallbacks[url];
        };

        var useNative = 'onload' in node;
        // onload for webkit 535.23  Firefox 9.0
        // https://bugs.webkit.org/show_activity.cgi?id=38995
        // https://bugzilla.mozilla.org/show_bug.cgi?id=185236
        // https://developer.mozilla.org/en/HTML/Element/link#Stylesheet_load_events
        // phantomjs 1.7 == webkit 534.34
        var forceCssPoll = S.Config['forceCssPoll'] || (UA.webkit && UA.webkit < 536);

        if (css && forceCssPoll && useNative) {
            useNative = false;
        }

        function onload() {
            var readyState = node.readyState;
            if (!readyState ||
                readyState == "loaded" ||
                readyState == "complete") {
                node.onreadystatechange = node.onload = null;
                end(0);
            }
        }

        //标准浏览器 css and all script
        if (useNative) {
            node.onload = onload;
            node.onerror = function () {
                node.onerror = null;
                end(1);
            };
        }
        // old chrome/firefox for css
        else if (css) {
            Utils.pollCss(node, function () {
                end(0);
            });
        } else {
            node.onreadystatechange = onload;
        }

        if (timeout) {
            timer = S.later(function () {
                end(1);
            }, timeout * MILLISECONDS_OF_SECOND);
        }
        if (!headNode) {
            headNode = Utils.docHead();
        }
        if (css) {
            // css order matters
            // so can not use css in head
            headNode.appendChild(node);
        } else {
            // can use js in head
            headNode.insertBefore(node, headNode.firstChild);
        }
        return node;
    };
})(KISSY);
/*
 yiminghe@gmail.com refactor@2012-03-29
 - 考虑连续重复请求单个 script 的情况，内部排队

 yiminghe@gmail.com 2012-03-13
 - getScript
 - 404 in ie<9 trigger success , others trigger error
 - syntax error in all trigger success
 */