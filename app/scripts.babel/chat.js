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
        } else {
            var cursorURL = typeof chrome !== "undefined" && chrome.extension ? chrome.extension.getURL('../../images/aero_arrow.png') : './images/aero_arrow.png';
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
        _storedSettings = null,
        _portManager = null,
        _users = {},
        _scrollPosition = {},
        _mouseVisible = true;

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        Logger.log('Chat View Initialized')
        chrome.storage.sync.get(['if-settings'], function(result) {
			_storedSettings = result['if-settings'];
            _portManager = new portManager("chat", onMessage);
            _scrollPosition = { x: 0, y: 0 };
        });
    };

    // events -------------------------------------------------------------------
    function onMessage(message) {
        Logger.log('got chat message', message)
        switch (message.event) {
            case 'connected':
                message_onConnected(message.data);
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
                if (_storedSettings.enableChat)
                    message_onUserchat(message.data);
                break;
            case 'disconnected':
                message_onDisconnect(message.data);
                break;
        }
    };

    // private functions ---------------------------------------------------------
    function submitInput(message) {
        var data = { message: message };
        _portManager.tell('userchat', data);
    };

    function getUser(userId) {
        if (!_users[userId])
            _users[userId] = new User(userId, submitInput);

        return _users[userId];
    };

    // messages -----------------------------------------------------------------
    function message_onConnected(data) {
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

document.addEventListener("DOMContentLoaded", function() { new Chat.init(); }, false);