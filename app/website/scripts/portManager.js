_portManagers = [];

var portManager = function (source, messageCallback, disconnectCallback){
	// variables ----------------------------------------------------------------
	var _this 				= {},
		_messageListener	= null,
		_disconnectListener	= null;
	
	// initialize ---------------------------------------------------------------
	_this.init = function (source, messageCallback, disconnectCallback){
		_this.tabId = 0;
		_this.source = source;
		_this.roomCode = "internetfriendswebsite";

		_messageListener = messageCallback;
		_disconnectListener = disconnectCallback;
		_portManagers.push(this);

		if (_backgroundPortManager)
			_backgroundPortManager.processTabPortConnected(this);

		Logger.log(`PortManager Initialized in "${source}"`);
	};
	
	// private functions --------------------------------------------------------

	// events -------------------------------------------------------------------

	// public functions ---------------------------------------------------------	
	_this.port_onMessage = function (message){
		// call the listener callback
		if (_messageListener) _messageListener(message);
	};

	_this.tell = function (event, data){
		var data = data || {};
		
		if(_backgroundPortManager != null) {
			_backgroundPortManager.processMessage({
				event	: event,
				data	: data
			}, _this.tabId, _this.source, _this.roomCode);
		}
	};

	// messages -----------------------------------------------------------------	
	_this.init(source, messageCallback, disconnectCallback);
	
	return _this;
};