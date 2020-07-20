var User = function (id, submitCallback){
	// variables ----------------------------------------------------------------
	var _this 				= {},
		_id 				= null,
		_mousePosition		= {},
		_userElement  		= null,
		_speechElement		= null,
		_inputElement		= null,
		_mouseElement		= null,
		_fadeoutTimer		= -1,
		_mouseFadeoutTimer 	= -1,
		_submitCallback 	= submitCallback;
	
	// initialize ---------------------------------------------------------------
	_this.init = function (id){
		_id				= id;
		_mousePosition 	= {x:0, y:0};
		_userElement 	= $('<div id="' + id + '" class="user"></div>').appendTo($('body'));
		_speechElement  = $('<p class="speech fadeout"></p>').appendTo(_userElement);

		Logger.log(_id);
		if(_id == "localuser") {
			_inputElement	= $('<span contenteditable="true" class="input"></span>').appendTo(_userElement);
			setupInputElement();
		} else {
			var cursorURL 	= chrome && chrome.extension ? chrome.extension.getURL('../../images/aero_arrow.cur') : './images/aero_arrow.cur';
			_mouseElement	= $('<div class="fakeMouse"></div>').appendTo(_userElement);
			_mouseBGElm		= $('<div class="fakeMouseBackgroundColor"></div>').appendTo(_mouseElement);
			_mouseBGElm.css({'background-image': 'url(' + cursorURL + ')'});
		}
	};
	
	// private functions --------------------------------------------------------
	function submitInput() {
	  if(_inputElement.text().length > 0) {
	  	_this.say(_inputElement.text());
	  	_submitCallback(_inputElement.text());
	    _inputElement.text('');
	  }
	}

	function hideInput() {
	  if(_inputElement.is(":visible")) {
	    //_inputElement.addClass('hidden');
	  }
	}

	function setupInputElement () {
		if (_inputElement) {
			_inputElement.keydown(function (e) {
				if (e.keyCode == 13) {
					e.preventDefault();
				} else if(_inputElement.text().length == 0 && e.keyCode == 8) {
					hideInput();
				}
			});

			_inputElement.keyup(function (e) {
				if (e.keyCode == 13) {
					submitInput();
					e.preventDefault();
				}
			});
		}
	};

	function repositionElements () {
  		_userElement.css('top',  _mousePosition.y + 'px');
		_userElement.css('left', _mousePosition.x + 'px');
	};

	// public functions ---------------------------------------------------------
	_this.focusInput = function ()
	{
		//_inputElement.removeClass('hidden');
		if (_inputElement) {
			_inputElement.blur();
			_inputElement.focus();
		}
	};

	_this.setMousePosition = function (x, y)
	{
		_mousePosition.x = x;
		_mousePosition.y = y;
		repositionElements();
		
		if (_mouseElement) {
			_mouseElement.removeClass("fadeout");
			clearTimeout(_mouseFadeoutTimer);
			_mouseFadeoutTimer = setTimeout(function () { _mouseElement.addClass("fadeout"); }, 5000);
		}
	};

	_this.say = function (message) {
		_speechElement.removeClass("fadeout");
	    _speechElement.html(message);

  		clearTimeout(_fadeoutTimer);
  		_fadeoutTimer = setTimeout(function () { _speechElement.addClass("fadeout"); }, 2000);
		
		if (_mouseElement) {
			_mouseElement.removeClass("fadeout");
			clearTimeout(_mouseFadeoutTimer);
			_mouseFadeoutTimer = setTimeout(function () { _mouseElement.addClass("fadeout"); }, 5000);
		}
	};

	_this.init(id);

	return _this;
};

Logger.log('init chat.js')

var Chat = (function (){
	// variables ----------------------------------------------------------------
	var _this 			= {},
		_portManager	= null,
		_users			= {},
		_scrollPosition = {};
	
	// initialize ---------------------------------------------------------------
	_this.init = function (){
		Logger.log('init chat')
		_portManager 	= new portManager("chat", onMessage);
		_scrollPosition = {x:0, y:0};
	};

	// events -------------------------------------------------------------------
	function onMessage (request){
		Logger.log('got chat message', request)
		switch (request.event){
			case 'scroll': message_onScroll(request.data); break;
			case 'mousemove': message_onMousemove(request.data); break;
			case 'mouseleave': message_onMouseleave(request.data); break;
			case 'enterpressed': message_onEnterpressed(request.data); break;
			case 'userchat': message_onUserchat(request.data); break;
		}
	};

	// private functions ---------------------------------------------------------
	function submitInput (message) {
		var data = {message:message};
		_portManager.tell("userchat", data);
	};

	function getUser (userId){
		if(!_users[userId])
			_users[userId] = new User(userId, submitInput);

		return _users[userId];
	};

	// messages -----------------------------------------------------------------
	function message_onScroll (data){
		_scrollPosition.x = data.scrollX;
		_scrollPosition.y = data.scrollY;
	}

	function message_onMousemove (data){
		var user = getUser(data.userId);
		var y = data.y - _scrollPosition.y;
		var x = data.x - _scrollPosition.x;
		user.setMousePosition(x, y);
	};

	function message_onMouseleave (data){
	};

	function message_onEnterpressed (data){
		var user = getUser(data.userId);
		user.focusInput();
		Logger.log('focus input');
	};

	function message_onUserchat (data){
		var user = getUser(data.userId);
		user.say(data.message);
	};

	return _this;
}());

document.addEventListener("DOMContentLoaded", function (){ new Chat.init(); }, false);