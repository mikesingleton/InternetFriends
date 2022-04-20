'use strict';

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

		// send messages from "background.js"
    	chrome.runtime.onConnect.addListener(processTabPortConnected);

		Logger.log('Internet Friends Background Port Manager Initialized');
	};
	
	// private functions --------------------------------------------------------
	function getUrl(port) {
		let url;
		
		if (port.sender.tab.url) { // Chrome
			url = new URL(port.sender.tab.url);
		}
		else // FireFox
		{
			var tabId = port.sender.tab.id;
			var source = port.name;
			if (source == 'InternetFriends-main') {
				url = new URL(port.sender.tab.url);
			} else if (_openTabs[tabId]['InternetFriends-main']) {
				url = new URL(_openTabs[tabId]['InternetFriends-main'].sender.url);
			}
		}
		
		return url;
	}

	function getRoomCodeFromPort(port, url) {
		// Room code is based on url and title
		// e.g. 'www.google.com/search : test - Google Search'
		// The goal is to group users based on the page they're currently on
		// Ignoring url.search because many websites url.search values are unique to each user
		var url = getUrl(port);
		return url.host + url.pathname + " : " + port.sender.tab.title;
	}

    // events -------------------------------------------------------------------
	function processTabPortConnected (port){
		// Only process if site not disabled
		var websiteUrl = getUrl(port);

		// If websiteUrl is present in disabledSites, InternetFriends is disabled for this site, return
		if (IFSettings.disabledSites[websiteUrl.host])
			return;

		var tabId = port.sender.tab.id;
		var source = port.name;
		var roomCode = getRoomCodeFromPort(port);
		
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
			// Setup Listeners
			_openTabs[tabId]['InternetFriends-chat'].onMessage.addListener(function (event) { processMessage(event, tabId, 'InternetFriends-chat', roomCode) });
			_openTabs[tabId]['InternetFriends-main'].onMessage.addListener(function (event) { processMessage(event, tabId, 'InternetFriends-main', roomCode) });
			_openTabs[tabId]['InternetFriends-chat'].onDisconnect.addListener(function () { processTabPortDisconnect(tabId, 'InternetFriends-chat', roomCode) });
			_openTabs[tabId]['InternetFriends-main'].onDisconnect.addListener(function () { processTabPortDisconnect(tabId, 'InternetFriends-main', roomCode) });

			// Post loaded messages
			_openTabs[tabId]['InternetFriends-chat'].postMessage({event: 'loaded'});
			_openTabs[tabId]['InternetFriends-main'].postMessage({event: 'loaded'});
		}
	};
    
    function processMessage (message, tabId, source, roomCode) {
        _messageCallback(message, roomCode);

        // Forward to iframe
        if(source != 'InternetFriends-chat') {
            message.data.userId = "localuser";
            _this.tellByTabId(tabId, message);
        }
    }

	function processTabPortDisconnect (tabId, source, roomCode){
		// process the disconnect
		if (_openTabs[tabId]) {
			delete _openTabs[tabId][source];
		}

		if(source == 'InternetFriends-main') {
			delete _openTabs[tabId];
			delete _rooms[roomCode][tabId];

			let tabIds = Object.keys(_rooms[roomCode]);

			// If there are no other tabs associated with this room code, disconnect
			if (tabIds.length === 0)
                _roomDisconnectCallback(roomCode);
		}
	};

	// public functions ---------------------------------------------------------	
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
            _openTabs[tabId]["InternetFriends-chat"].postMessage(data);
            return true;
        }

        return false;
	};

	_this.updateBadgeTextByRoomCode = function (roomCode, peers) {
		if (!_rooms[roomCode])
			return false;
		
		// Loop through all tabs that are associated with the given room code
		for (var tabId in _rooms[roomCode]) {
			chrome.browserAction.setBadgeText(
				{
					text: peers > 0 ? peers.toString() : '',
					tabId: parseInt(tabId)
				}
			);
		}

		return true;
	};

	// messages -----------------------------------------------------------------	
	_this.init(messageCallback, roomDisconnectCallback);
	
	return _this;
};
