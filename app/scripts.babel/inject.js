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
        _iframe = null,
        //_portManager = null,
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
        _iframe = document.createElement('iframe');
        _iframe.onload = function () {
            sendMessage('init', { roomCode: getRoomCode() });

            // send visible if visible
            if (!isPageHidden())
                sendMessage('pageVisible');

            // add event listeners
            document.addEventListener("scroll", dom_onScroll, false);
            document.addEventListener("mouseover", dom_onMousemove, false);
            document.addEventListener("mousemove", dom_onMousemove, false);
            document.addEventListener("mouseenter", dom_onMouseenter, false);
            document.addEventListener("mouseleave", dom_onMouseleave, false);

            // if chat is not enabled, return
            if (!IFSettings.enableChat) {
                Logger.log('Chat disabled. Disabling Key Combo Listeners.');
                return;
            }

            // only detect key presses if chat is enabled
            document.addEventListener("keydown", dom_onKeydown, false);
            document.addEventListener("keyup", dom_onKeyup, false);
            document.addEventListener("webkitvisibilitychange", dom_onVisibilityChange, false);
            document.addEventListener("msvisibilitychange", dom_onVisibilityChange, false);
        };

        _iframe.src = typeof chrome !== "undefined" && chrome.runtime ? chrome.runtime.getURL('html/iframe/chat.html?view=chat&_' + new Date().getTime()) : './html/iframe/chat.html';
        _container.append(_iframe);
    };

    // private functions --------------------------------------------------------
    function getRoomCode() {
		// Room code is based on url and title
		// e.g. 'www.google.com/search : test - Google Search'
		// The goal is to group users based on the page they're currently on
		// Ignoring url.search because many websites url.search values are unique to each user
        return document.location.host + document.location.pathname + ':' + document.title;
    }

    function sendMessage(event, data) {
        // chrome-extension://namkigeilfgjhccknbahjkdolfbapckn ?
        // Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('chrome-extension://namkigeilfgjhccknbahjkdolfbapckn') does not match the recipient window's origin ('https://www.youtube.com').
        _iframe.contentWindow.postMessage({ event, data: data || {} }, 'chrome-extension://namkigeilfgjhccknbahjkdolfbapckn');
    }

    function isPageHidden() {
        return document.hidden || document.msHidden || document.webkitHidden;
    }

    // events -------------------------------------------------------------------
    function dom_onScroll() {
        var data = { scrollX: window.scrollX, scrollY: window.scrollY };
        sendMessage("scroll", data);
    };

    function dom_onMousemove(event) {
        var data = { x: event.pageX, y: event.pageY, vw: ((event.pageX / document.documentElement.clientWidth) * 100) };
        sendMessage("mousemove", data);
    };

    function dom_onMouseenter(event) {
        sendMessage("mouseenter");
    };

    function dom_onMouseleave(event) {
        sendMessage("mouseleave");
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
            sendMessage("openchat");
            _comboDown = false;
            event.preventDefault();
        }
    };

    function dom_onVisibilityChange(event) {
        if (!isPageHidden()) {
            sendMessage("pageVisible");
        } else {
            sendMessage("pageHidden");
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