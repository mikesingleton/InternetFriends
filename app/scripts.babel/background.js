'use strict';

var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')

var Background = (function() {
    // variables ----------------------------------------------------------------
    var _this = {},
        _storedSettings = null,
        _local = true,
        _portManager = null,
        _guid = null,
        _swarms = {},
        _connectionAttempts = {};

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        // retrieve settings on init
        chrome.storage.sync.get(['if-settings'], function(result) {
            _storedSettings = result['if-settings'];

            // receive post messages from 'inject.js' and any iframes
            _portManager = new backgroundPortManager(processMessageFromBrowser, processRoomDisconnect);
            _guid = guid();
            chrome.browserAction.setBadgeBackgroundColor({color: _storedSettings.userColor });

            // add listener for storage changes
            chrome.storage.onChanged.addListener(function (changes, namespace) {
                for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
                    Logger.log(`Storage key "${key}" in namespace "${namespace}" changed.`);

                    // update settings
                    if (key === "if-settings") {
                        _storedSettings = newValue;

                        chrome.browserAction.setBadgeBackgroundColor({color: _storedSettings.userColor });
                    }
                }
            });
        
            Logger.log('Internet Friends Background Script Initialized');
        });
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

    function connectToSwarm(roomCode, callback) {
        if (_swarms[roomCode] || _connectionAttempts[roomCode])
            return;

        // mark connection attempt so we don't make multiple attempts at the same time
        _connectionAttempts[roomCode] = true;

        Logger.log('connecting to swarm ', roomCode);

        // init connection message
        var connectionMessage = {
            event: 'connected',
            data: {
                userColor: _storedSettings.userColor,
            }
        }

        // send connection message to front end
        connectionMessage.data.userId = 'localuser';
        const foundRoom = _portManager.tellByRoomCode(roomCode, connectionMessage);
        if (!foundRoom) {
            disconnectFromSwarm(roomCode);
            return;
        }

        var hub = signalhub(roomCode, _local ? ['localhost:8080'] : ['https://if-signalhub.herokuapp.com/'])
        _swarms[roomCode] = swarm(hub, {
            wrtc: require('wrtc') // don't need this if used in the browser
        })

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
            _portManager.updateBadgeByRoomCode(roomCode, true, _swarms[roomCode].peers.length);

            // send connection message to peers on connection
            connectionMessage.data.source = 'peer';
            connectionMessage.data.userId = _guid;
            peer.send(JSON.stringify(connectionMessage));
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
        
        // remove roomCode from list of _connectionAttempts
        delete _connectionAttempts[roomCode];

        callback();
    };

    function disconnectFromSwarm(roomCode) {
        if (_swarms[roomCode]) {
            _swarms[roomCode].close()
            delete _swarms[roomCode]
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