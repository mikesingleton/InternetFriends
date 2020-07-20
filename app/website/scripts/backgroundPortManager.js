
_backgroundPortManager = null;

var backgroundPortManager = function (messageCallback, roomDisconnectCallback){
	// variables ----------------------------------------------------------------
	var _this 				    = {},
        _openTabs 			    = {},
		_messageCallback	    = null,
		_roomDisconnectCallback	= null;
	
	// initialize ---------------------------------------------------------------
	_this.init = function (messageCallback, roomDisconnectCallback){
		_messageCallback = messageCallback;
		_roomDisconnectCallback = roomDisconnectCallback;
		_backgroundPortManager = this;

		if (_portManagers && _portManagers.length)
		{
			for (var i = 0; i < _portManagers.length; i++) {
				_this.processTabPortConnected(_portManagers[i]);
			}
		}

		Logger.log('backgroundPortManager init');
	};
	
	// private functions --------------------------------------------------------

    // events -------------------------------------------------------------------
	_this.processTabPortConnected = function (port){
		var tabId = 1;
		var source = port.source;
		var roomCode = "internetfriendswebsite";

		Logger.log('tab connected: ' + tabId)

		// Add port to tab
		if(!_openTabs[tabId]) 
			_openTabs[tabId] = {};

		_openTabs[tabId][source] = port;

		if(_openTabs[tabId]['InternetFriends-chat'] &&
			_openTabs[tabId]['InternetFriends-main'])
		{
			_openTabs[tabId]['InternetFriends-main'].postMessage({event: 'loaded', data: {}});
			_openTabs[tabId]['InternetFriends-chat'].postMessage({event: 'loaded', data: {}});
		}

		_messageCallback({event:'tabConnected', data: {}}, roomCode);
    };

	// public functions ---------------------------------------------------------	
	_this.postMessage = function (message, tabId, source, roomCode) {
		_messageCallback(message, roomCode);
		
		//Logger.log(message);

        // Forward to iframe
        if(source != 'InternetFriends-chat') {
            message.data.userId = "localuser";
            _this.tellByTabId(1, message);
        }
	}

	_this.tellByRoomCode = function (roomCode, data){
		var tabId = 1;
		if(_openTabs[tabId]["InternetFriends-chat"]) {
			_openTabs[tabId]["InternetFriends-chat"].postMessage(data);
			return true;
		}

        return false;
    };
    
    _this.tellByTabId = function (tabId, data){
		var tabId = 1;
        if(_openTabs[tabId] && _openTabs[tabId]["InternetFriends-chat"]) {
            _openTabs[tabId]["InternetFriends-chat"].postMessage(data);
            return true;
        }

        return false;
	};

	// messages -----------------------------------------------------------------	
	_this.init(messageCallback, roomDisconnectCallback);
	
	return _this;
};