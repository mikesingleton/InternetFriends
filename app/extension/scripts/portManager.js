var portManager = function (source, messageCallback, disconnectCallback){
	// variables ----------------------------------------------------------------
	var _this 				= {},
		_source				= "",
		_port				= null,
		_messageListener	= null,
		_disconnectListener	= null;
	
	// initialize ---------------------------------------------------------------
	_this.init = function (source, messageCallback, disconnectCallback){
		_source = source;
		_messageListener = messageCallback;
		_disconnectListener = disconnectCallback;

		Logger.log(`PortManager Initialized in "${source}"`);
	};
	
	// public functions ---------------------------------------------------------	
	_this.tell = function (event, data){
		var data = data || {};
		
		if(_port != null) {
			_port.postMessage({
				event	: event,
				data	: data
			});
		}
	};
	
	_this.connect = function () {
		Logger.log("Connecting to Background Script...");

		_port = chrome.runtime.connect({name: "InternetFriends-" + source});

		if (_messageListener) _port.onMessage.addListener(_messageListener);	
		if (_disconnectListener) _port.onDisconnect.addListener(_disconnectListener);
	}

	_this.disconnect = function () {
		if (!_port)
			return;
			
		Logger.log("Disconnecting from Background Script...");

		_port.disconnect();
		_port = null;
	}

	// messages -----------------------------------------------------------------	
	_this.init(source, messageCallback, disconnectCallback);
	
	return _this;
};