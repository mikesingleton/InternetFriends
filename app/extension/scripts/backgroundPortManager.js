'use strict';

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

		// send messages from "background.js"
    	chrome.runtime.onConnect.addListener(processTabPortConnected);

		Logger.log('backgroundPortManager init');
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
		// Ignoring url.search because many websites values unique to each user
		// The goal is to group users based on the page they're currently on
		var url = getUrl(port);
		return url.host + url.pathname + " : " + port.sender.tab.title;
	}

    // events -------------------------------------------------------------------
	function processTabPortConnected (port){
		// Get Settings. Only process if site not disabled
		chrome.storage.sync.get(['if-settings'], function(result) {
			var settings = result['if-settings'];
			var websiteUrl = getUrl(port);

			// If websiteUrl is present in disabledSites, InternetFriends is disabled for this site, return
			if (settings.disabledSites[websiteUrl.host])
				return;

			var tabId = port.sender.tab.id;
			var source = port.name;
			var roomCode = getRoomCodeFromPort(port);
			
			Logger.log('tab connected: ' + tabId)

			// Add port to tab
			if(!_openTabs[tabId]) 
				_openTabs[tabId] = {};

			_openTabs[tabId][source] = port;

			if(_openTabs[tabId]['InternetFriends-chat'] &&
				_openTabs[tabId]['InternetFriends-main'])
			{
				_openTabs[tabId]['InternetFriends-main'].postMessage({event: 'loaded'});
				_openTabs[tabId]['InternetFriends-chat'].postMessage({event: 'loaded'});
			}

			// Setup Listeners
			port.onMessage.addListener(function (event) { processMessage(event, tabId, source, roomCode) });
			port.onDisconnect.addListener(function () { processTabPortDisconnect(tabId, source, roomCode) });
		});
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
		delete _openTabs[tabId][source];
		if(source == 'InternetFriends-main') {
			delete _openTabs[tabId];

			let found = false;
			for (var tabId in _openTabs) {
				if (Object.prototype.hasOwnProperty.call(_openTabs, tabId)) {
					if(_openTabs[tabId]["InternetFriends-chat"] && getRoomCodeFromPort(_openTabs[tabId]["InternetFriends-chat"]) == roomCode) {
						found = true;
					}
				}
			}

			if (!found)
                _roomDisconnectCallback(roomCode);
		}
	};

	// public functions ---------------------------------------------------------	
	_this.tellByRoomCode = function (roomCode, data){
        for (var tabId in _openTabs) {
            if (Object.prototype.hasOwnProperty.call(_openTabs, tabId)) {
                if(_openTabs[tabId]["InternetFriends-chat"] && getRoomCodeFromPort(_openTabs[tabId]["InternetFriends-chat"]) == roomCode) {
                    _openTabs[tabId]["InternetFriends-chat"].postMessage(data);
                    return true;
                }
            }
        }

        return false;
    };
    
    _this.tellByTabId = function (tabId, data){
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
