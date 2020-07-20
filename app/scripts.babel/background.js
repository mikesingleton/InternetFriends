'use strict';

var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')

var Background = (function (){
	// variables ----------------------------------------------------------------
	var _this 				= {},
		_portManager		= null,
		_guid				= null,
		_connectionTime 	= 5000,
		_connectionTimeout 	= 10000,
		_swarms				= {},
		_throttleSend		= throttle(sendMessageToSwarm, 100);
			
	// initialize ---------------------------------------------------------------
	_this.init = function (){
		// receive post messages from 'inject.js' and any iframes
		_portManager = new backgroundPortManager(processMessageFromBrowser, processRoomDisconnect);
		_guid = guid();

		Logger.log('init');
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

		Logger.log('connecting to swarm', roomCode);

		var hub = signalhub(roomCode, ['https://if-signalhub.herokuapp.com/'])
		_swarms[roomCode] = swarm(hub, {
			wrtc: require('wrtc') // don't need this if used in the browser
		})

		_swarms[roomCode].on('peer', function (peer, id) {
			Logger.log('connected to a new peer:', id)
			Logger.log('total peers:', _swarms[roomCode].peers.length)
			peer.on('data', (payload) => {
				const data = JSON.parse(payload.toString())
				data.source = 'peer'
				data.userId = id
				//Logger.log(data);

				const foundRoom = _portManager.tellByRoomCode(roomCode, data);				
				if (!foundRoom) {
					disconnectFromSwarm(roomCode)
				}
			})
		})
		
		/*
		_swarms[roomCode].on('disconnect', function (peer, id) {
			Logger.log('disconnected from a peer:', id)
		})
		*/
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
	function processMessageFromBrowser (message, roomCode){
		if(message.event == 'pageHidden') {
			// DISCONNECT FROM TO HUB CHANNEL AT URL AFTER 10 SECONDS
			disconnectFromSwarm(roomCode);
		} else if(message.event == 'pageVisible') {
			// CONNECT TO HUB CHANNEL AT URL AFTER 10 SECONDS
			connectToSwarm(roomCode);

		/*} else if(message.event == 'mousemove') {
			//TODO: use _throttleSend when connected to many peers
			var wsMessage = JSON.parse(JSON.stringify(message));
			wsMessage.data.userId = _guid;
			_throttleSend(wsMessage, roomCode);*/
		} else if(message.event != 'scroll'){
			var wsMessage = JSON.parse(JSON.stringify(message));
			wsMessage.data.userId = _guid;
			sendMessageToSwarm(wsMessage, roomCode);
		}
	};

	function processRoomDisconnect (roomCode){
		disconnectFromSwarm(roomCode);
	};

	return _this;
}());

Background.init();