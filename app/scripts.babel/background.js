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
        _streamPeers = {};

    // initialize ---------------------------------------------------------------
    _this.init = function() {
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

    function connectToSwarm(roomCode) {
        if (_swarms[roomCode])
            return;

        Logger.log('connecting to swarm', roomCode);

        var hub = signalhub(roomCode, _local ? ['localhost:8080'] : ['https://if-signalhub.herokuapp.com/'])
        _swarms[roomCode] = swarm(hub, {
            wrtc: require('wrtc') // don't need this if used in the browser
        })

        _swarms[roomCode].on('peer', function(peer, id) {
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

            if (_streamPeers[id]) {
                clearInterval(_streamPeers[id].audioInterval);
                delete _streamPeers[id];
            }
        })
    };

    function disconnectFromSwarm(roomCode) {
        if (_swarms[roomCode]) {
            _swarms[roomCode].close()
            delete _swarms[roomCode]
        }
    };

    function sendMessageToSwarm(message, roomCode) {
        if (!_swarms[roomCode])
            connectToSwarm(roomCode)

        if (_swarms[roomCode]) {
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