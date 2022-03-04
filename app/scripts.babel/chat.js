var User = function(id, submitCallback) {
    // variables ----------------------------------------------------------------
    var _this = {},
        _id = null,
        _mousePosition = {},
        _userElement = null,
        _speechElement = null,
        _inputElement = null,
        _mouseElement = null,
        _mouseBGElm = null,
        _mouseAudioVis = null,
        _fadeoutTimer = -1,
        _submitCallback = submitCallback;

    // initialize ---------------------------------------------------------------
    _this.init = function(id) {
        _id = id;
        _mousePosition = { x: 0, y: 0 };
        _userElement = $('<div id="' + id + '" class="user" style="left: -16px;"></div>').appendTo($('body'));
        _speechElement = $('<p class="speech fadeout"></p>').appendTo(_userElement);

        Logger.log(_id);
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
    };

    // public functions ---------------------------------------------------------
    _this.setAudioAmplitude = function(amplitude) {
        Logger.log(amplitude);
        if (amplitude > 80)
            amplitude = 80;

        _mouseAudioVis.css('transform', 'scale(' + amplitude / 80 + ')');
    }

    _this.focusInput = function() {
        if (_inputElement) {
            _inputElement.blur();
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

    _this.say = function(message) {
        _speechElement.removeClass("fadeout");
        _speechElement.html(message);

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

Logger.log('init chat.js')

var Chat = (function() {
    // variables ----------------------------------------------------------------
    var _this = {},
        _portManager = null,
        _users = {},
        _scrollPosition = {};

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        Logger.log('init chat')
        _portManager = new portManager("chat", onMessage);
        _scrollPosition = { x: 0, y: 0 };
    };

    // events -------------------------------------------------------------------
    function onMessage(message) {
        Logger.log('got chat message', message)
        switch (message.event) {
            case 'scroll':
                message_onScroll(message.data);
                break;
            case 'mousemove':
                message_onMousemove(message.data);
                break;
            case 'mouseleave':
                message_onMouseleave(message.data);
                break;
            case 'enterpressed':
                message_onEnterpressed(message.data);
                break;
            case 'userchat':
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
    function message_onScroll(data) {
        _scrollPosition.x = data.scrollX;
        _scrollPosition.y = data.scrollY;
    }

    function message_onMousemove(data) {
        var user = getUser(data.userId);
        var y = data.y - _scrollPosition.y;
        var x = data.x - _scrollPosition.x;
        user.setMousePosition(x, y);
    };

    function message_onMouseleave(data) {};

    function message_onEnterpressed(data) {
        var user = getUser(data.userId);
        user.focusInput();
        Logger.log('focus input');
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