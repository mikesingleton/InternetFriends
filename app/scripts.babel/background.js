var debug = true;
var Logger = {
    log: debug ? console.log.bind(console) : function(){}
};

var IFSettings;
var IFEvents = new EventTarget();

// wrap in a self-invoking function to use define private variables & functions
(function () {
    // define 'init' event
    var initEvent = new Event('settings.init');

    // define default combo
    var _defaultCombo = {
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        key: "Enter"
    };

    // define function for getting a random color
    function getRandomIroColor () {
        var iroColor = new iro.Color('{a: 1, h: 0, s: 70, v: 90}');
        iroColor.hue += Math.random() * 360;
        return iroColor.hslaString;
    }

    // if chrome is available
    if (chrome && chrome.storage) {
        // retrieve settings
        chrome.storage.sync.get(null, function(result) {
            var storedSettings = result;

            // set IFSettings based on storedSettings, get default values if necessary
            IFSettings = {
                combo: storedSettings?.combo || _defaultCombo,
                disabledSites: storedSettings?.disabledSites || {},
                enableChat: storedSettings?.enableChat === true || storedSettings?.enableChat === undefined,
                userColor: storedSettings?.userColor || getRandomIroColor()
            }

            // set new settings
            chrome.storage.sync.set(IFSettings);

            Logger.log('Settings initialized:')
            Logger.log(IFSettings);
            IFEvents.dispatchEvent(initEvent);
        });

        // listen for changes to settings
        chrome.storage.onChanged.addListener(function (changes, namespace) {
            for (let [key, { newValue }] of Object.entries(changes)) {
                Logger.log(`Storage key "${key}" in namespace "${namespace}" changed.`);

                // update settings
                IFSettings[key] = newValue;
                IFEvents.dispatchEvent(new Event('settings.change.' + key));

                Logger.log(IFSettings);
            }
        });
    }
    // otherwise this is loaded outside an extension
    else
    {
        // set IFSettings with default values
        IFSettings = {
            combo: _defaultCombo,
            disabledSites: {},
            enableChat: true,
            userColor: getRandomIroColor()
        }
        
        IFEvents.dispatchEvent(initEvent);
    }
}());

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
			chrome.action.setBadgeText(
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

import { v4 as uuidv4 } from 'uuid';
var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')

var Background = (function() {
    // variables ----------------------------------------------------------------
    var _this = {},
        _local = false,
        _portManager = null,
        _swarms = {};

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        // receive post messages from 'inject.js' and any iframes
        _portManager = new backgroundPortManager(processMessageFromBrowser, processRoomDisconnect);

        if (chrome && chrome.action) {
            chrome.action.setBadgeBackgroundColor({ color: IFSettings.userColor });
        
            // add listener for storage changes
            IFEvents.addEventListener('settings.change.userColor', function () {
                chrome.action.setBadgeBackgroundColor({color: IFSettings.userColor });
            });
        }
    
        Logger.log('Internet Friends Background Script Initialized');
    };

    // private functions --------------------------------------------------------
    function connectToSwarm(roomCode, callback) {
        if (_swarms[roomCode])
            return;

        Logger.log('connecting to swarm ', roomCode);

        // init user info message
        var userInfoMessage = {
            event: 'userInfo',
            data: {
                userId: 'localuser',
                userColor: IFSettings.userColor,
            }
        }

        // send user info message to front end
        _portManager.tellByRoomCode(roomCode, userInfoMessage);

        var hub = signalhub(roomCode, _local ? ['localhost:8080'] : ['https://if-signalhub.herokuapp.com/'])
        _swarms[roomCode] = swarm(hub, { wrtc: require('wrtc'), uuid: uuidv4() })

        _swarms[roomCode].on('peer', function(peer, id) {
            Logger.log('connected to a new peer:', id)
            Logger.log('total peers:', _swarms[roomCode].peers.length)

            // setup data listener
            peer.on('data', (payload) => {
                const message = JSON.parse(payload.toString())
                message.data.source = 'peer'
                message.data.userId = id
                Logger.log(message);

                // Forward the message to the chat window
                const foundRoom = _portManager.tellByRoomCode(roomCode, message);
                if (!foundRoom) {
                    disconnectFromSwarm(roomCode)
                }
            })

            // update the badge based on the number of peers
            _portManager.updateBadgeTextByRoomCode(roomCode, _swarms[roomCode].peers.length);

            // send user info message to peers on connection
            userInfoMessage.data.userColor = IFSettings.userColor;
            peer.send(JSON.stringify(userInfoMessage));
        })

        _swarms[roomCode].on('disconnect', function(peer, id) {
            Logger.log('disconnected from a peer:', id)
            _portManager.tellByRoomCode(roomCode, {
                event: 'disconnected',
                data: {
                    source: 'peer',
                    userId: id
                }
            });
            
            // update the badge based on the number of peers
            _portManager.updateBadgeTextByRoomCode(roomCode, _swarms[roomCode] ? _swarms[roomCode].peers.length : 0);
        })

        // Resend user info if the user color is changed
        IFEvents.addEventListener('settings.change.userColor', function () {
            userInfoMessage.data.userColor = IFSettings.userColor;

            // send to the swarm
            sendMessageToSwarm(userInfoMessage, roomCode);

            // also send locally
            _portManager.tellByRoomCode(roomCode, userInfoMessage);
        });

        if (callback)
            callback();
    };

    function disconnectFromSwarm(roomCode) {
        if (_swarms[roomCode]) {
            Logger.log('disconnecting from swarm ', roomCode);

            _swarms[roomCode].close()
            delete _swarms[roomCode]
            
            Logger.log('disconnected');
        }
    };

    function sendMessageToSwarm(message, roomCode) {
        // if message if intended for a new swarm
        if (!_swarms[roomCode]) {
            // connect to the new swarm
            connectToSwarm(roomCode, function () {
                // once connected, send the message to the swarm
                if (_swarms[roomCode]) {
                    _swarms[roomCode].peers.forEach((peer) => {
                        peer.send(JSON.stringify(message));
                    });
                }
            });
        }
        // already connected, send the message to the swarm
        else if (_swarms[roomCode]) {
            _swarms[roomCode].peers.forEach((peer) => {
                peer.send(JSON.stringify(message));
            });
        }
    };

    // events -------------------------------------------------------------------
    function processMessageFromBrowser(message, roomCode) {
        if (message.event == 'pageHidden') {
            disconnectFromSwarm(roomCode);
        } else if (message.event == 'pageVisible') {
            connectToSwarm(roomCode);
        } else if (message.event != 'scroll') {
            var wsMessage = JSON.parse(JSON.stringify(message));
            sendMessageToSwarm(wsMessage, roomCode);
        }
    };

    function processRoomDisconnect(roomCode) {
        disconnectFromSwarm(roomCode);
    };

    return _this;
}());

// If IFSettings have not been initialized, wait for init event to be dispatched
if (!IFSettings) {
    IFEvents.addEventListener('settings.init', function () {
        Background.init();
    });
} else {
    // else, init now
    Background.init();
}