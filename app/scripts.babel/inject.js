var Inject = (function() {
    // constants ----------------------------------------------------------------
    var ID = {
        CONTAINER: 'internetFriends-container',
        IFRAME: 'internetFriends-iframe'
    };

    // variables ----------------------------------------------------------------
    var _this = {},
        _container = null,
        _iframe = null,
        _iframeOrigin = null,
        _roomCode = null,
        _comboDown = false,
        _browserExtensionIds = [
            'lhhkoincelmladajmdhodgbaacpbalbg',     // Chrome
            'cdijpialkplmolkgbdgbjmglaiimkhfb'      // Edge
        ];;

    // initialize ---------------------------------------------------------------
    _this.tryInit = function() {
        // special cases depending on where this script is running
        // (within the website or within the chrome extension or both)
        // the same script is embedded within the website and the chrome extension
        // so that users who have not installed the chrome extension can interact with
        // those who have as long as they're on the internetfriends website

        if (typeof chrome === "undefined" || !chrome.runtime) {
            // chrome runtime is unavailable, init
            _this.init();
            return;
        }
        
        if (chrome.runtime.id) {
            // this script is running within the chrome extension, init
            _this.init();
            return;
        }
        
        if (!chrome.runtime.id)
        {
            // this script is running within the browser
            // check to see if the extension is also already running in the browser
            testExtensionRunning(_browserExtensionIds, 0);
        }
    }

    _this.init = function() {
        Logger.log(`Internet Friends Initializing Room "${window.location.host + window.location.pathname} : ${document.title}"`);

        // if websiteUrl is present in disabledSites, InternetFriends is disabled for this site, return
        let websiteUrl = window.location.host;
        if (IFSettings.disabledSites[websiteUrl]) {
            Logger.log('Website is disabled. Exiting.');
            return;
        }

        // add message listener
        window.addEventListener("message", (event) => {
            switch (event.data.event) {
                case 'iframeInitialized':
                    onIframeInitialized(event.data.data);
                    break;
            }
        });

        // create the main container
        _container = document.createElement('div');
        _container.id = ID.CONTAINER;
        document.body.append(_container);
        
        // add the "chat" iframe
        _iframe = document.createElement('iframe');
        _iframe.id = ID.IFRAME;
        _iframe.src = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('html/iframe/chat.html?view=chat&_' + new Date().getTime()) : './html/iframe/chat.html';
        _container.append(_iframe);
    };

    // private functions --------------------------------------------------------
    function testExtensionRunning(browserExtensionIds, index)
    {
        if (index >= browserExtensionIds.length)
        {
            // an attempt has been made to contact each browser extension by it's id, all have failed
            // the Internet Friends browser extension is not running, init
            _this.init();
            return;
        }


        chrome.runtime.sendMessage(browserExtensionIds[index], { message: "version" },
            function (reply) {
                if (reply) {
                    // this script is running outside of the extension, but the extension is already installed and running, do nothing
                    return;
                }

                if (chrome.runtime.lastError) {
                    // there was an error contacting the extension (likely not running), try the next one in the array
                    testExtensionRunning(browserExtensionIds, index++);
                    return;
                }
            }
        );
    }

    function onIframeInitialized(data) {
        Logger.log('iFrame initialized at origin ' + data.origin + ', sendMessage and swarm events are now available');

        // set the iframe origin
        _iframeOrigin = data.origin;

        // update the room code
        _roomCode = getRoomCode();
        onRoomCodeChanged();

        // add listener to detect room code changes that occur without page refresh
        new MutationObserver(() => {
            let roomCode = getRoomCode();
            if (_roomCode !== roomCode) {
                _roomCode = roomCode;
                onRoomCodeChanged();
            }
        }).observe(document, {subtree: true, childList: true});
        
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
    }

    function onRoomCodeChanged() {
        sendMessage('roomCodeChanged', { roomCode: _roomCode });
    }

    function getRoomCode() {
		// Room code is based on url and title
		// e.g. 'www.google.com/search?test-GoogleSearch'
		// The goal is to group users based on the page they're currently on
		// Ignoring url.search because many websites url.search values are unique to each user

        // Title used to create unique rooms for sites like YouTube or Google
        // Remove parenthsis with numbers for cases where title contains number of notifications e.g. '(1) YouTube'
        // Remove spaces to normalize cases where padding is used in the title
        // Remove * characters for cases where * is used in the title to indicate that a change has been made
        var title = document.title.replace(/\(\d*\)|\*|\s/g, "");
                
        return document.location.host + document.location.pathname + '?' + title;
    }

    function sendMessage(event, data = {}) {
        data.userId = 'localuser';
        _iframe.contentWindow.postMessage({ event, data }, _iframeOrigin);
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
                Inject.tryInit();
            });
        } else {
            // else, init now
            Inject.tryInit();
        }
    }, false);
} else {
    console.log("InternetFriends does not work without WebRTC support!"); // use console log here so it's logged regardless of whether general logging is enabled
}