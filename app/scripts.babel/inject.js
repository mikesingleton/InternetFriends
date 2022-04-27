var Inject = (function() {
    // constants ----------------------------------------------------------------
    var ID = {
        CONTAINER: 'internetFriends-container',
        IFRAME_PREFIX: 'internetFriends-iframe-'
    };

    // variables ----------------------------------------------------------------
    var _this = {},
        _views = {},
        _container = null,
        _portManager = null,
        _comboDown = false;

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        Logger.log(`Internet Friends Initializing Room "${window.location.host + window.location.pathname} : ${document.title}"`);

        // If websiteUrl is present in disabledSites, InternetFriends is disabled for this site, return
        let websiteUrl = window.location.host;
        if (IFSettings.disabledSites[websiteUrl]) {
            Logger.log('Website is disabled. Exiting.');
            return;
        }

        // create the main container
        _container = $('<div />', { id: ID.CONTAINER });
        _container.appendTo(document.body);

        // add the "chat" iframe
        getView('chat', _container);

        // setup port manager to communicate with background.js
        _portManager = new portManager("main", onMessage, onDisconnect);
        _portManager.tell("tabInit");

        // add event listeners
        document.addEventListener("scroll", dom_onScroll, false);
        document.addEventListener("mouseover", dom_onMousemove, false);
        document.addEventListener("mousemove", dom_onMousemove, false);
        document.addEventListener("mouseenter", dom_onMouseenter, false);
        document.addEventListener("mouseleave", dom_onMouseleave, false);
        document.addEventListener("webkitvisibilitychange", dom_onVisibilityChange, false);
        document.addEventListener("msvisibilitychange", dom_onVisibilityChange, false);

        // if chat is not enabled, return
        if (!IFSettings.enableChat) {
            Logger.log('Chat disabled. Disabling Key Combo Listeners.');
            return;
        }

        // only detect key presses if chat is enabled
        document.addEventListener("keydown", dom_onKeydown, false);
        document.addEventListener("keyup", dom_onKeyup, false);
    };

    // private functions --------------------------------------------------------
    function getView(id) {
        // return the view if it's already created
        if (_views[id]) return _views[id];

        // iframe initial details
        var src = typeof chrome !== "undefined" && chrome.runtime ? chrome.runtime.getURL('html/iframe/' + id + '.html?view=' + id + '&_' + new Date().getTime()) : './html/iframe/chat.html',
            iframe = $('<iframe/>', { id: ID.IFRAME_PREFIX + id, src: src, scrolling: false });

        // view
        _views[id] = {
            isLoaded: false,
            iframe: iframe
        };

        // add to the container
        _container.append(iframe);

        return _views[id];
    };

    // messages coming from "background.js"
    function onMessage(request) {
        Logger.log(request);

        switch (request.event) {
            case 'loaded':
                message_onLoaded();
                break;
        }
    };

    function onDisconnect() {
        Logger.log("Tab Disconnected from Background Scripts");

        // remove related elements
        getView('chat', _container).iframe.remove();
        _container.remove();

        // remove event listeners
        document.removeEventListener("scroll", dom_onScroll, false);
        document.removeEventListener("mouseover", dom_onMousemove, false);
        document.removeEventListener("mousemove", dom_onMousemove, false);
        document.removeEventListener("mouseenter", dom_onMouseenter, false);
        document.removeEventListener("mouseleave", dom_onMouseleave, false);
        document.removeEventListener("keydown", dom_onKeydown, false);
        document.removeEventListener("keyup", dom_onKeyup, false);
        document.removeEventListener("webkitvisibilitychange", dom_onVisibilityChange, false);
        document.removeEventListener("msvisibilitychange", dom_onVisibilityChange, false);

        _portManager = null;
    };

    function isPageHidden() {
        return document.hidden || document.msHidden || document.webkitHidden;
    }

    // messages -----------------------------------------------------------------
    function message_onLoaded() {
        var data = { scrollX: window.scrollX, scrollY: window.scrollY };

        if (_portManager)
            _portManager.tell("scroll", data);
    }

    // events -------------------------------------------------------------------
    function dom_onScroll() {
        var data = { scrollX: window.scrollX, scrollY: window.scrollY };
        _portManager.tell("scroll", data);
    };

    function dom_onMousemove(event) {
        var data = { x: event.pageX, y: event.pageY, vw: ((event.pageX / document.documentElement.clientWidth) * 100) };
        _portManager.tell("mousemove", data);
    };

    function dom_onMouseenter(event) {
        _portManager.tell("mouseenter");
    };

    function dom_onMouseleave(event) {
        _portManager.tell("mouseleave");
    };

    function dom_onKeydown(event) {
        var key = event.key;
        var combo = IFSettings.combo;
        // Detect combo press
        if (event.ctrlKey == combo.ctrlKey && event.shiftKey == combo.shiftKey && event.altKey == combo.altKey && key === combo.key) {
            // If the combo does not contain any modifiers, only trigger when the document body has focus, otherwise return
            if (!combo.ctrlKey && !combo.shiftKey && !combo.altKey && document.activeElement !== document.body)
                return;

            _comboDown = true;
            event.preventDefault();
        }
    };

    function dom_onKeyup(event) {
        var key = event.key;
        var combo = IFSettings.combo;
        // Detect combo release
        if (event.ctrlKey == combo.ctrlKey && event.shiftKey == combo.shiftKey && event.altKey == combo.altKey && key === combo.key && _comboDown) {
            Logger.log('Key Combo Detected. Opening Chat.');
            _portManager.tell("openchat");
            _comboDown = false;
            event.preventDefault();
        }
    };

    function dom_onVisibilityChange(event) {
        if (isPageHidden()) {
            _portManager.tell("pageHidden");
        } else {
            _portManager.tell("pageVisible");
        }
    }

    return _this;
}());

var isWebRTCSupported = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia ||
    window.RTCPeerConnection;

if (isWebRTCSupported) {
    document.addEventListener("DOMContentLoaded", function() {
        // If IFSettings have not been initialized, wait for init event to be dispatched
        if (!IFSettings) {
            IFEvents.addEventListener('settings.init', function () {
                Inject.init();
            });
        } else {
            // else, init now
            Inject.init();
        }
    }, false);
} else {
    console.log("InternetFriends does not work without WebRTC support!"); // use console log here so it's logged regardless of whether general logging is enabled
}