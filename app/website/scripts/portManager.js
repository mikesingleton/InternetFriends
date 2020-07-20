_portManagers = [];

var portManager = function (source, messageCallback, disconnectCallback){
	// variables ----------------------------------------------------------------
	var _this 				= {},
		_tabId				= 1,
		_source				= "",
		_roomCode			= "internetfriendswebsite",
		_port				= null,
		_messageListener	= null,
		_disconnectListener	= null,
		_disconnectTimer 	= -1;

	_this.source = "";
	
	// initialize ---------------------------------------------------------------
	_this.init = function (source, messageCallback, disconnectCallback){
		_source = "InternetFriends-" + source;
		_this.source = _source;
		_messageListener = messageCallback;
		_disconnectListener = disconnectCallback;
		_portManagers.push(this);

		if (_backgroundPortManager)
			_backgroundPortManager.processTabPortConnected(this);

		// receive messages from "background.js"
		Logger.log('portManager init', source);
	};
	
	// public functions ---------------------------------------------------------
	_this.postMessage = function (message) {
		Logger.log(message);
		if (_messageListener)
			_messageListener(message);
	}

	_this.disconnect = function () {
		if (_disconnectListener)
			_disconnectListener();
	}

	_this.tell = function (event, data){
		var data = data || {};
		
		if(_backgroundPortManager != null) {
			_backgroundPortManager.postMessage({
				event	: event,
				data	: data
			}, _tabId, _source, _roomCode);
		}
	};

	// messages -----------------------------------------------------------------	
	_this.init(source, messageCallback, disconnectCallback);
	
	return _this;
};