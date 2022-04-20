'use strict';

var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')

var Background = (function() {
    // variables ----------------------------------------------------------------
    var _this = {},
        _local = true,
        _portManager = null,
        _swarms = {};

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        // receive post messages from 'inject.js' and any iframes
        _portManager = new backgroundPortManager(processMessageFromBrowser, processRoomDisconnect);

        if (chrome) {
            chrome.browserAction.setBadgeBackgroundColor({ color: IFSettings.userColor });
        
            // add listener for storage changes
            IFEvents.addEventListener('settings.change.userColor', function () {
                chrome.browserAction.setBadgeBackgroundColor({color: IFSettings.userColor });
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
        _swarms[roomCode] = swarm(hub)

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

// Wait for settings to initialize to init background
IFEvents.addEventListener('settings.init', function () {
    Background.init();
});