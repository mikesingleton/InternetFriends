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
        _enterDown = false;

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        // create the main container
        _container = $('<div />', { id: ID.CONTAINER });
        _container.appendTo(document.body);

        // add the "chat" iframe
        getView('chat', _container);

        // setup port manager to communicate with background.js
        _portManager = new portManager("main", onMessage, onDisconnect);
        _portManager.tell("tabInit");

        // send initial scroll value


        // add event listeners
        document.addEventListener("scroll", dom_onScroll, false);
        document.addEventListener("mouseover", dom_onMousemove, false);
        document.addEventListener("mousemove", dom_onMousemove, false);
        document.addEventListener("mouseleave", dom_onMouseleave, false);
        document.addEventListener("keydown", dom_onKeydown, false);
        document.addEventListener("keyup", dom_onKeyup, false);
        document.addEventListener("webkitvisibilitychange", dom_onVisibilityChange, false);
        document.addEventListener("msvisibilitychange", dom_onVisibilityChange, false);
    };

    // private functions --------------------------------------------------------
    function getView(id) {
        // return the view if it's already created
        if (_views[id]) return _views[id];

        // iframe initial details
        var src = typeof chrome !== "undefined" && chrome.extension ? chrome.extension.getURL('html/iframe/' + id + '.html?view=' + id + '&_' + new Date().getTime()) : './html/iframe/chat.html',
            iframe = $('<iframe/>', { id: ID.IFRAME_PREFIX + id, src: src, scrolling: false });

        Logger.log(src, iframe);

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
        Logger.log("disconnected");

        // remove related elements
        getView('chat', _container).iframe.remove();
        _container.remove();

        // remove event listeners
        document.removeEventListener("scroll", dom_onScroll, false);
        document.removeEventListener("mouseover", dom_onMousemove, false);
        document.removeEventListener("mousemove", dom_onMousemove, false);
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
        var data = { x: event.pageX, y: event.pageY };
        _portManager.tell("mousemove", data);
    };

    function dom_onMouseleave(event) {
        _portManager.tell("mouseleave");
    };

    function dom_onKeydown(event) {
        var key = event.which || event.keyCode;
        if (event.ctrlKey && event.shiftKey && key === 13) {
            _enterDown = true;
            event.preventDefault();
        }
    };

    function dom_onKeyup(event) {
        var key = event.which || event.keyCode;
        if (event.ctrlKey && event.shiftKey && key === 13 && _enterDown) {
            Logger.log('hey');
            _portManager.tell("enterpressed");
            _enterDown = false;
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

if (isWebRTCSupported)
    document.addEventListener("DOMContentLoaded", function() { Inject.init(); }, false);
else
    Logger.log("InternetFriends does not work without WebRTC support!");