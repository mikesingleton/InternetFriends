//import { v4 as uuidv4 } from 'uuid';
var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')

var IFSwarm = function(roomCode, messageCallback) {
    // variables ----------------------------------------------------------------
    var _this = {},
        _local = true,
        _roomCode = null,
        _swarm = null,
        _messageCallback = messageCallback,
        _userInfoMessage = {
            event: 'userInfo',
            data: {}
        };

    
    // initialize ---------------------------------------------------------------
    function init() {
        _roomCode = roomCode;
    };

    // public functions --------------------------------------------------------
    _this.connect = function() {
        if (_swarm)
            return;

        Logger.log('connecting to swarm ', _roomCode);

        var hub = signalhub(_roomCode, _local ? ['localhost:8080'] : ['https://if-signalhub.herokuapp.com/'])
        _swarm = swarm(hub, { wrtc: require('wrtc') })

        _swarm.on('peer', function(peer, id) {
            Logger.log('connected to a new peer:', id)
            Logger.log('total peers:', _swarm.peers.length)

            // setup data listener
            peer.on('data', (payload) => {
                const message = JSON.parse(payload.toString())
                message.data.source = 'peer'
                message.data.userId = id
                Logger.log(message);

                // fire callback with the given message
                _messageCallback(message);
            })

            // update the badge based on the number of peers
            chrome.runtime.sendMessage({ event: 'updateBadgeText', data: { peers: _swarm ? _swarm.peers.length : 0 }});

            // send user info message to peers on connection
            _userInfoMessage.data.userColor = IFSettings.userColor;
            peer.send(JSON.stringify(_userInfoMessage));
        })

        _swarm.on('disconnect', function(peer, id) {
            Logger.log('disconnected from a peer:', id)
            
            // fire callback with the given message
            _messageCallback({
                event: 'disconnected',
                data: {
                    source: 'peer',
                    userId: id
                }
            });
            
            // update the badge based on the number of peers
            chrome.runtime.sendMessage({ event: 'updateBadgeText', data: { peers: _swarm ? _swarm.peers.length : 0 }});
        })

        // Resend user info if the user color is changed
        IFEvents.addEventListener('settings.change.userColor', function () {
            _userInfoMessage.data.userColor = IFSettings.userColor;

            // send to the swarm
            _this.sendMessage(_userInfoMessage);
        });
    };

    _this.disconnect = function () {
        if (!_swarm)
            return;

        Logger.log('disconnecting from swarm ', _roomCode);

        _swarm.close()
        _swarm = null;
        
        Logger.log('disconnected');
    };

    _this.sendMessage = function (message) {
        if (!_swarm)
            return;

        _swarm.peers.forEach((peer) => {
            peer.send(JSON.stringify(message));
        });
    };

    init();
	
	return _this;
};

var User = function(id, submitCallback) {
    // variables ----------------------------------------------------------------
    var _this = {},
        _id = null,
        _mousePosition = {},
        _userElement = null,
        _speechElement = null,
        _textElement = null,
        _inputElement = null,
        _mouseElement = null,
        _mouseBGElm = null,
        _userFilter = "",
        _flipped = false,
        _fadeoutTimer = -1,
        _submitCallback = submitCallback;

    // initialize ---------------------------------------------------------------
    _this.init = function(id) {
        _id = id;
        _mousePosition = { x: 0, y: 0 };
        _userElement = $('<div id="' + id + '" class="user" style="left: -16px; filter: ' + _userFilter + '"></div>').appendTo($('body'));
        _speechElement = $('<p class="speech fadeout"></p>').appendTo(_userElement);
        _textElement = $('<p class="text"></p>').appendTo(_speechElement);

        Logger.log(`new User Initialized "${_id}"`);
        if (_id == "localuser") {
            _inputElement = $('<span contenteditable="true" class="input"></span>').appendTo(_userElement);
            setupInputElement();
            _this.setColor(IFSettings.userColor);

            // Add listener for color changes
            IFEvents.addEventListener('settings.change.userColor', function () {
                _this.setColor(IFSettings.userColor);
            });
        } else {
            var cursorURL = typeof chrome !== "undefined" && chrome.runtime ? chrome.runtime.getURL('../../images/aero_arrow.png') : './images/aero_arrow.png';
            _mouseElement = $('<div class="fakeMouse"></div>').appendTo(_userElement);
            _mouseBGElm = $('<div class="fakeMouseBackgroundColor"></div>').appendTo(_mouseElement);
            _mouseBGElm.css({ 'background-image': 'url(' + cursorURL + ')' });
        }
    };

    // private functions --------------------------------------------------------
    function submitInput() {
        if (_inputElement.text().length > 0) {
            _this.say(_inputElement.text());
            _submitCallback(_inputElement.text());
            _inputElement.text('');
        }
    }

    function setupInputElement() {
        if (_inputElement) {
            _inputElement.keydown(function(e) {
                if (e.keyCode == 13) {
                    // prevent new line in input element
                    e.preventDefault();
                }
            });

            _inputElement.keyup(function(e) {
                if (e.keyCode == 13) {
                    submitInput();
                    e.preventDefault();
                }
            });
        }
    };

    function repositionElements() {
        _userElement.css('top', _mousePosition.y + 'px');
        _userElement.css('left', _mousePosition.x + 'px');

        if (!_flipped && _mousePosition.x > document.documentElement.clientWidth / 2) {
            _flipped = true;
            _userElement.addClass('flipped');
        } else if (_flipped && _mousePosition.x < document.documentElement.clientWidth / 2) {
            _flipped = false;
            _userElement.removeClass('flipped');
        }
    };

    // public functions ---------------------------------------------------------
    _this.focusInput = function() {
        if (_inputElement) {
            _inputElement.blur();
            _inputElement.text('');
            _inputElement.focus();
        }
    };

    _this.setMousePosition = function(x, y) {
        _mousePosition.x = x;
        _mousePosition.y = y;
        repositionElements();

        if (_mouseElement) {
            _mouseElement.removeClass("fadeout");
        }
    };

    _this.setColor = function(userColor) {
        let initColor = { h: 207, s: 86, v: 95 };
        let iroColor = new iro.Color(userColor);
        let hsl = iroColor.hsl;

        // validate color values
        if (hsl.s < 50)
            hsl.s = 50;

        _userFilter = "hue-rotate(" + (hsl.h - initColor.h) + "deg) saturate(" + (hsl.s / initColor.s * 100) + "%)";

        // add filter to mouse background element to change user color
        _userElement.css('filter', _userFilter);
    }

    _this.say = function(message) {
        _speechElement.removeClass("fadeout");
        _textElement.html(message);

        var words = message.split(' ').length;
        var wordsPerMinute = 200;
        var millisecondsPerWord = (1 / wordsPerMinute) * 60 * 1000;
        var displayTime = millisecondsPerWord * words + 1000; // adds 1 second buffer

        clearTimeout(_fadeoutTimer);
        _fadeoutTimer = setTimeout(function() { _speechElement.addClass("fadeout"); }, displayTime);
    };

    _this.destroy = function() {
        _userElement.remove();
        _submitCallback = null;
        clearTimeout(_fadeoutTimer);
    };

    _this.init(id);

    return _this;
};

var Chat = (function() {
    // variables ----------------------------------------------------------------
    var _this = {},
        _roomCode = null,
        _users = {},
        _scrollPosition = { x: 0, y: 0 },
        _mouseVisible = true,
        _swarm = null;

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        Logger.log('Chat View Initialized')

        window.addEventListener("message", (event) => {
            event.data.data.userId = 'localuser';
            onMessage(event.data);
        });
    };

    // events -------------------------------------------------------------------
    function onMessage(message) {
        Logger.log('got chat message', message)

        // forward certain messages that didn't come from the swarm (from a peer)
        if (_swarm && (!message.data.source || message.data.source != 'peer')) {
            switch (message.event) {
                case 'userInfo':
                case 'mousemove':
                case 'userchat':
                case 'disconnected':
                    _swarm.sendMessage(message);
                    break;
            }
        }

        // process messages
        switch (message.event) {
            case 'init':
                message_onInit(message.data);
                break;
            case 'pageVisible':
                message_onPageVisible();
                break;
            case 'pageHidden':
                message_onPageHidden();
                break;
            case 'userInfo':
                message_onUserInfo(message.data);
                break;
            case 'scroll':
                message_onScroll(message.data);
                break;
            case 'mousemove':
                message_onMousemove(message.data);
                break;
            case 'mouseenter':
                message_onMouseenter(message.data);
                break;
            case 'mouseleave':
                message_onMouseleave(message.data);
                break;
            case 'openchat':
                message_onOpenchat(message.data);
                break;
            case 'userchat':
                // only process 'userchat' messages if chat is enabled
                if (IFSettings.enableChat)
                    message_onUserchat(message.data);
                break;
            case 'disconnected':
                message_onDisconnect(message.data);
                break;
        }
    };

    // private functions ---------------------------------------------------------
    function submitInput(message) {
        // process locally
        message_onUserchat({ userId: 'localuser', message: message })

        // send to swarm
        if (_swarm) {
            _swarm.sendMessage({
                event: 'userchat',
                data: {
                    message: message
                }
            });
        }
    };

    function getUser(userId) {
        if (!_users[userId])
            _users[userId] = new User(userId, submitInput);

        return _users[userId];
    };

    // messages -----------------------------------------------------------------
    function message_onInit(data) {
        _roomCode = data.roomCode;
        _swarm = new IFSwarm(_roomCode, onMessage);
    }

    function message_onPageVisible() {
        _swarm.connect();
    }

    function message_onPageHidden() {
        _swarm.disconnect();
    }

    function message_onUserInfo(data) {
        var user = getUser(data.userId);
        user.setColor(data.userColor);
    }

    function message_onScroll(data) {
        _scrollPosition.x = data.scrollX;
        _scrollPosition.y = data.scrollY;
    }

    function message_onMousemove(data) {
        var user = getUser(data.userId);
        var y = data.y - _scrollPosition.y;
        
        // If x scroll potition is 0, scale position based on viewport
        var x;
        if (_scrollPosition.x === 0) {
            x = ((data.vw / 100) * document.documentElement.clientWidth);
        } else { // else use absolute value
            x = data.x - _scrollPosition.x;
        }

        user.setMousePosition(x, y);
    };

    function message_onMouseenter(data) {
        _mouseVisible = true;
    };

    function message_onMouseleave(data) {
        _mouseVisible = false;
    };

    function message_onOpenchat(data) {
        // only open chat if the mouse is on the page
        if (_mouseVisible) {
            var user = getUser(data.userId);
            user.focusInput();
        }
    };

    function message_onUserchat(data) {
        var user = getUser(data.userId);
        user.say(data.message);
    };

    function message_onDisconnect(data) {
        var user = getUser(data.userId);
        user.destroy();
        delete _users[data.userId];
    };

    return _this;
}());

document.addEventListener("DOMContentLoaded", function() {
    // If IFSettings have not been initialized, wait for init event to be dispatched
    if (!IFSettings) {
        IFEvents.addEventListener('settings.init', function () {
            new Chat.init();
        });
    } else {
        // else, init now
        new Chat.init();
    }
}, false);