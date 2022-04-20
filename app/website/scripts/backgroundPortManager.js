_backgroundPortManager = null;

var backgroundPortManager = function (messageCallback, roomDisconnectCallback){
	// variables ----------------------------------------------------------------
	var _this 				    = {},
        _openTabs 			    = {},
		_rooms					= {},
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

		Logger.log('Internet Friends Background Port Manager Initialized');
	};

    // events -------------------------------------------------------------------

	// public functions ---------------------------------------------------------
	_this.processTabPortConnected = function (port) {
		var tabId = port.tabId;
		var source = 'InternetFriends-' + port.source;
		var roomCode = port.roomCode;
		
		Logger.log('Tab Connected RoomCode: ' + roomCode + ' ID: ' + tabId);

		// Add port to tab
		if(!_openTabs[tabId]) 
			_openTabs[tabId] = {};

		_openTabs[tabId][source] = port;
		
		// Create room
		if (!_rooms[roomCode])
			_rooms[roomCode] = {};

		// Add tab to room
		_rooms[roomCode][tabId] = true;

		// After both sources have connected
		if(_openTabs[tabId]['InternetFriends-chat'] &&
			_openTabs[tabId]['InternetFriends-main'])
		{
			_messageCallback({event:'tabConnected', data: {}}, roomCode);

			// Post loaded messages
			_openTabs[tabId]['InternetFriends-chat'].port_onMessage({event: 'loaded'});
			_openTabs[tabId]['InternetFriends-main'].port_onMessage({event: 'loaded'});
		}
	};
    
    _this.processMessage = function (message, tabId, source, roomCode) {
        _messageCallback(message, roomCode);

        // Forward to iframe
        if(source != 'InternetFriends-chat') {
            message.data.userId = "localuser";
            _this.tellByTabId(tabId, message);
        }
    }

	_this.tellByRoomCode = function (roomCode, data){
		if (!_rooms[roomCode])
			return false;

		let success = false;
		
		// Loop through all tabs that are associated with the given room code
		for (var tabId in _rooms[roomCode]) {
        	success ||= _this.tellByTabId(tabId, data);
		}

		// If any tabs were found, this should return true
		return success;
    };

    _this.tellByTabId = function (tabId, data){
        if(_openTabs[tabId] && _openTabs[tabId]["InternetFriends-chat"]) {
            _openTabs[tabId]["InternetFriends-chat"].port_onMessage(data);
            return true;
        }

        return false;
	};
	
	_this.updateBadgeTextByRoomCode = function (roomCode, peers) {
		// empty method used in extension
	}

	// messages -----------------------------------------------------------------	
	_this.init(messageCallback, roomDisconnectCallback);
	
	return _this;
};
