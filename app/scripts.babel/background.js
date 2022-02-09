'use strict';

var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')

var Background = (function (){
	// variables ----------------------------------------------------------------
	var _this 				= {},
		_local				= true,
		_portManager		= null,
		_guid				= null,
		_connectionTime 	= 5000,
		_connectionTimeout 	= 10000,
		_swarms				= {},
		_throttleSend		= throttle(sendMessageToSwarm, 100),
		_streamPeers		= {};
			
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

		var hub = signalhub(roomCode, _local ? ['localhost'] : ['https://if-signalhub.herokuapp.com/'])
		_swarms[roomCode] = swarm(hub, {
			wrtc: require('wrtc') // don't need this if used in the browser
		})

		_swarms[roomCode].on('peer', function (peer, id) {
			Logger.log('connected to a new peer:', id)
			Logger.log('total peers:', _swarms[roomCode].peers.length)

			peer.on('data', (payload) => {
				const message = JSON.parse(payload.toString())
				message.data.source = 'peer'
				message.data.userId = id
				Logger.log(message);

				// Add peer to list of peers to stream to
				if (message.event == 'streamSettings') {
					_streamPeers[id] = { peer };
				}

				// Forward the message to the chat window
				const foundRoom = _portManager.tellByRoomCode(roomCode, message);				
				if (!foundRoom) {
					disconnectFromSwarm(roomCode)
				}
			})

			// Send Stream Settings (Currently audio only on by default)
			/* Disable streaming audio for now
			peer.send(JSON.stringify({
				event: 'streamSettings',
				data: {
					globalAudio: true,
					partyAudio: true,
					//globalVideo: false,
					//partyVideo: false
				}
			}));

			peer.on('stream', (stream) => {
				Logger.log('received stream', stream);
				
				const audioEl = document.createElement('audio');
				audioEl.id;
				audioEl.srcObject = stream;
				audioEl.play();
				document.body.appendChild(audioEl);

				// Create audio processor to show when each user is talking
				createAudioProcessor(stream, roomCode, id);
			})
			*/
		})
		
		_swarms[roomCode].on('disconnect', function (peer, id) {
			Logger.log('disconnected from a peer:', id)
			_portManager.tellByRoomCode(roomCode, {
				event: 'disconnected',
				data: {
					source: 'peer',
					userId: id
				}
			});	

			if (_streamPeers[id]) {
				clearInterval(_streamPeers[id].audioInterval);
				delete _streamPeers[id];
			}
		})
	};

	async function getMediaStream(opts) {
		return navigator.mediaDevices.getUserMedia(opts)
	}

	async function getMyStream() {
		const audio = {
			autoGainControl: true,
			sampleRate: {ideal: 48000, min: 35000},
			echoCancellation: true,
			channelCount: {ideal: 1},
		}

		const stream = await getMediaStream({audio})
      	return stream;
	}

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

	function createAudioProcessor(stream, roomCode, id) {
		// https://stackoverflow.com/questions/33322681/checking-microphone-volume-in-javascript
		var audioCtx = new AudioContext();
		var analyser = audioCtx.createAnalyser();
		analyser.fftSize = 32;
		analyser.smoothingTimeConstant = 0.1;
		var source = audioCtx.createMediaStreamSource(stream);
		source.connect(analyser);

		var message = { event: 'audioAmplitude', data: { source: 'peer', userId: id, amplitude: 0 } }
		
		_streamPeers[id].audioInterval = setInterval(function () {
			var array = new Uint8Array(analyser.frequencyBinCount);
			analyser.getByteFrequencyData(array);
			var sum = array.reduce(function(a, b){ return a + b; }, 0);
			var avg = sum / array.length;

			message.data.amplitude = avg;
			const foundRoom = _portManager.tellByRoomCode(roomCode, message);
		}, 100);
	}
	
	// events -------------------------------------------------------------------
	function processMessageFromBrowser (message, roomCode){
		if(message.event == 'pageHidden') {
			// DISCONNECT FROM TO HUB CHANNEL AT URL AFTER 10 SECONDS
			disconnectFromSwarm(roomCode);
		} else if(message.event == 'pageVisible') {
			// CONNECT TO HUB CHANNEL AT URL AFTER 10 SECONDS
			connectToSwarm(roomCode);
		} else if(message.event == 'streamSettingsConfirmed') {
			var peerId = message.data;
			Logger.log('Ready to send stream to peer ' + peerId);
			getMyStream().then(stream => _streamPeers[peerId].peer.addStream(stream));

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