'use strict';

var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')

var Background = (function() {
    // variables ----------------------------------------------------------------
    var _this = {},
        _local = true,
        _portManager = null,
        _guid = null,
        _swarms = {},
        _connectionAttempts = {};

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        // receive post messages from 'inject.js' and any iframes
        _portManager = new backgroundPortManager(processMessageFromBrowser, processRoomDisconnect);
        _guid = guid();

        Logger.log('Internet Friends Background Script Initialized');
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

    function connectToSwarm(roomCode) {
        if (_swarms[roomCode])
            return;

        Logger.log('connecting to swarm ', roomCode);

        var hub = signalhub(roomCode, _local ? ['localhost:8080'] : ['https://if-signalhub.herokuapp.com/'])
        _swarms[roomCode] = swarm(hub, {
            wrtc: require('wrtc') // don't need this if used in the browser
        })

        _swarms[roomCode].on('peer', function(peer, id) {
            Logger.log('connected to a new peer:', id)
            Logger.log('total peers:', _swarms[roomCode].peers.length)

            // send connection message
            var connectionMessage = {
                event: 'connected',
                data: {
                    source: 'peer',
                    userId: _guid,
                    userColor: _storedSettings.userColor,
                }
            }

            peer.send(JSON.stringify(connectionMessage));

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
        })
    };

    function disconnectFromSwarm(roomCode) {
        if (_swarms[roomCode]) {
            _swarms[roomCode].close()
            delete _swarms[roomCode]
        }
    };

    function sendMessageToSwarm(message, roomCode) {
        // if message if intended for a new swarm
        if (!_swarms[roomCode] && !_connectionAttempts[roomCode]) {
            // mark connection attempt so we don't make multiple at the same time
            _connectionAttempts[roomCode] = true;

            // retrieve settings before connecting to a new swarm
            chrome.storage.sync.get(['if-settings'], function(result) {
                _storedSettings = result['if-settings'];

                // connect to the new swarm
                connectToSwarm(roomCode);

                // send the message to the swarm
                if (_swarms[roomCode]) {
                    _swarms[roomCode].peers.forEach((peer) => {
                        peer.send(JSON.stringify(message));
                    });
                }

                // remove roomCode from list of _connectionAttempts
                delete _connectionAttempts[roomCode];
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
            wsMessage.data.userId = _guid;
            sendMessageToSwarm(wsMessage, roomCode);
        }
    };

    function processRoomDisconnect(roomCode) {
        disconnectFromSwarm(roomCode);
    };

    return _this;
}());

Background.init();