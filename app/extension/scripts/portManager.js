var portManager = function (source, messageCallback, disconnectCallback){
	// variables ----------------------------------------------------------------
	var _this 				= {},
		_tabId				= -1,
		_source				= "",
		_port				= null,
		_messageListener	= null,
		_disconnectListener	= null,
		_disconnectTimer 	= -1;
	
	// initialize ---------------------------------------------------------------
	_this.init = function (source, messageCallback, disconnectCallback){
		_source = source;
		_messageListener = messageCallback;
		_disconnectListener = disconnectCallback;

		// receive messages from "background.js"
		_port = chrome.runtime.connect({name: "InternetFriends-" + source});
		_port.onMessage.addListener(port_onMessage);	
		_port.onDisconnect.addListener(port_onDisconnect);

		Logger.log('portManager init', source);
	};
	
	// private functions --------------------------------------------------------

	// events -------------------------------------------------------------------
	function port_onMessage (message){
		// call the listener callback
		if (_messageListener) _messageListener(message);
	};

	function port_onDisconnect (){
		if (_disconnectListener) _disconnectListener();
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

	// messages -----------------------------------------------------------------	
	_this.init(source, messageCallback, disconnectCallback);
	
	return _this;
};