'use strict';

var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')

var Background = (function (){
	// variables ----------------------------------------------------------------
	var _this 				= {},
		_guid				= null,
		_openTabs 			= {},
		_connectionTime 	= 5000,
		_connectionTimeout 	= 10000,
		_swarms				= {},
		_throttleSend		= throttle(sendMessageToSwarm, 100);
			
	// initialize ---------------------------------------------------------------
	_this.init = function (){
		// receive post messages from 'inject.js' and any iframes
    	chrome.runtime.onConnect.addListener(processTabPortConnected);
    
		_guid = guid();

		console.log('init');
	};
	
	// private functions --------------------------------------------------------
	function guid() {
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000)
			.toString(16)
			.substring(1);
		}
		return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
			s4() + '-' + s4() + s4() + s4();
	}

	function connectToSwarm (roomCode) {
		if (_swarms[roomCode])
			return;

		console.log('connecting to swarm', roomCode);

		var hub = signalhub(roomCode, ['localhost:8080'/*,'https://if-signalhub.herokuapp.com/'*/])
		_swarms[roomCode] = swarm(hub, {
			wrtc: require('wrtc') // don't need this if used in the browser
		})

		_swarms[roomCode].on('peer', function (peer, id) {
			console.log('connected to a new peer:', id)
			console.log('total peers:', _swarms[roomCode].peers.length)
			peer.on('data', (payload) => {
				const data = JSON.parse(payload.toString())
				data.source = 'peer'
				data.userId = id
				console.log(data);

				let found = false;
				for (var tabId in _openTabs) {
					if (Object.prototype.hasOwnProperty.call(_openTabs, tabId)) {
						if(_openTabs[tabId]["InternetFriends-chat"] && _openTabs[tabId]["InternetFriends-chat"].sender.tab.url.split('?')[0] == roomCode) {
							_openTabs[tabId]["InternetFriends-chat"].postMessage(data);
							found = true;
						}
					}
				}
				
				if (!found) {
					disconnectFromSwarm(roomCode)
				}
			})
		})
		
		_swarms[roomCode].on('disconnect', function (peer, id) {
			console.log('disconnected from a peer:', id)
		})
	};

	function disconnectFromSwarm (roomCode) {
		if (_swarms[roomCode]) {
			_swarms[roomCode].close()
			delete _swarms[roomCode]
		}
	};

	function sendMessageToSwarm (message, roomCode) {
		if (!_swarms[roomCode])
			connectToSwarm(roomCode)
		
		if (_swarms[roomCode]) {
			_swarms[roomCode].peers.forEach((peer) => {
				peer.send(JSON.stringify(message));
			});
		}
	};

	function processMessage (message, tabId, source, roomCode){
		// Forward to WS (if mousemove or mouseleave)
		if(source != 'peer') {
			if(message.event == 'pageHidden') {
				// DISCONNECT FROM TO HUB CHANNEL AT URL AFTER 10 SECONDS
				disconnectFromSwarm(roomCode);
			} else if(message.event == 'pageVisible') {
				// CONNECT TO HUB CHANNEL AT URL AFTER 10 SECONDS
				connectToSwarm(roomCode);
			} else if(message.event == 'mousemove') {
				var wsMessage = JSON.parse(JSON.stringify(message));
				wsMessage.data.userId = _guid;
				sendMessageToSwarm(wsMessage, roomCode);
				//TODO: use _throttleSend when connected to many peers
				// _throttleSend(wsMessage);
			} else {
				var wsMessage = JSON.parse(JSON.stringify(message));
				wsMessage.data.userId = _guid;
				if(wsMessage.event != 'scroll')
					sendMessageToSwarm(wsMessage, roomCode);
			}
		}

		// Forward to iframe
		if(source != 'InternetFriends-chat') {
			if (_openTabs[tabId] && _openTabs[tabId]['InternetFriends-chat']) {
				message.data.userId = "localuser";
				_openTabs[tabId]['InternetFriends-chat'].postMessage(message);
			}/* else {
				disconnectFromSwarm(roomCode)
			}*/ // This might be good to ensure that swarm is disconnected, but it currently disconnects immediately because the 'main' port gets connected before the 'chat' port
		}
	};

	function throttle(fn, threshhold, scope) {
		threshhold || (threshhold = 250);
			var last,
			deferTimer;
		return function () {
			var context = scope || this;

			var now = +new Date,
			args = arguments;
			if (last && now < last + threshhold) {
				// hold on to it
				clearTimeout(deferTimer);
			deferTimer = setTimeout(function () {
				last = now;
				fn.apply(context, args);
				}, threshhold);
			} else {
				last = now;
				fn.apply(context, args);
			}
		};
	};
	
	// events -------------------------------------------------------------------
	function processTabPortConnected (port){
		var tabId = port.sender.tab.id;
		var source = port.name;
		var roomCode = port.sender.tab.url.split('?')[0];

		console.log('tab connected: ' + tabId)

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
	};

	function processTabPortDisconnect (tabId, source, roomCode){
		// process the disconnect
		delete _openTabs[tabId][source];
		if(source == 'InternetFriends-main') {
			delete _openTabs[tabId];

			let found = false;
			for (var tabId in _openTabs) {
				if (Object.prototype.hasOwnProperty.call(_openTabs, tabId)) {
					if(_openTabs[tabId]["InternetFriends-chat"] && _openTabs[tabId]["InternetFriends-chat"].sender.tab.url.split('?')[0] == roomCode) {
						found = true;
					}
				}
			}

			if (!found)
				disconnectFromSwarm(roomCode);
		}
	};

	return _this;
}());

window.addEventListener('load', function() { Background.init(); }, false);