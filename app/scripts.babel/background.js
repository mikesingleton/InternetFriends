// ---------------------------------------- Logger ----------------------------------------
var debug = true;
var Logger = {
    log: debug ? console.log.bind(console) : function(){}
};

// ---------------------------------------- Settings ----------------------------------------
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

// ---------------------------------------- Background Port Manager ----------------------------------------
var backgroundPortManager = function (){
	// variables ----------------------------------------------------------------
	var _this 				    = {},
        _openTabs 			    = {},
		_rooms					= {};
	
	// initialize ---------------------------------------------------------------
	function init(){
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

	function getRoomCodeFromPort(port) {
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
			_openTabs[tabId]['InternetFriends-chat'].postMessage({event: 'loaded', data: { roomCode: getRoomCodeFromPort(port) }});
			_openTabs[tabId]['InternetFriends-main'].postMessage({event: 'loaded', data: { roomCode: getRoomCodeFromPort(port) }});
		}
	};
    
    function processMessage (message, tabId, source, roomCode) {
        if (source === 'InternetFriends-main') {
            // messages coming from main source (inject)
            // forward to chat
            message.data.userId = "localuser";
            _this.tellByTabId(tabId, message);
        } else if (source === 'InternetFriends-chat') {
            // messages coming from chat
            if (message.event === 'updateBadgeText') {
                _this.updateBadgeTextByRoomCode(roomCode, message.data.peers);
            }
        }
    }

	function processTabPortDisconnect (tabId, source, roomCode){
		// process the disconnect
		if (_openTabs[tabId]) {
			delete _openTabs[tabId][source];
		}

		if (source == 'InternetFriends-main') {
			delete _openTabs[tabId];
			delete _rooms[roomCode][tabId];
		}
	};

	// public functions ---------------------------------------------------------	    
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
	init();
	
	return _this;
};

// ---------------------------------------- Background Script ----------------------------------------

var Background = (function() {
    // variables ----------------------------------------------------------------
    var _this = {},
        _portManager = null;

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        // receive post messages from 'inject.js' and any iframes
        _portManager = new backgroundPortManager();

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

    // events -------------------------------------------------------------------

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