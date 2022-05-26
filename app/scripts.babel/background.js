// ---------------------------------------- External Message Listener ----------------------------------------
chrome.runtime.onMessageExternal.addListener(
    function(request, sender, sendResponse) {
        if (request) {
            if (request.message) {
                if (request.message == "version") {
                    sendResponse({version: chrome.runtime.getManifest().version});
                }
            }
        }
    }
);

// ---------------------------------------- Badge Text Listener ----------------------------------------
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.event === 'updateBadgeText')
        {
            let peers = request.data.peers;

            chrome.action.setBadgeText(
                {
                    text: peers > 0 ? peers.toString() : '',
                    tabId: sender.tab.id
                }
            );
        }
        else if (request.event === 'updateBadgeColor')
        {
            chrome.action.setBadgeBackgroundColor({ color: request.data.userColor });
        }

        // dummy response due to bug: https://stackoverflow.com/questions/71520198/manifestv3-new-promise-error-the-message-port-closed-before-a-response-was-rece/71520415#71520415
        sendResponse();
    }
);

// ---------------------------------------- Logger ----------------------------------------
var debug = false;
var Logger = {
    log: debug ? console.log.bind(console) : function(){}
};

// ---------------------------------------- Settings ----------------------------------------
// wrap in a self-invoking function to use define private variables & functions
(function () {
    // define default combo
    var _defaultCombo = {
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        key: "Enter"
    };

    // define function for getting a random color
    function getRandomColor () {
        return 'hsla(' + Math.round(Math.random() * 360) + ', 78%, 54%, 1)';
    }

    // if chrome is available
    if (chrome && chrome.storage) {
        // retrieve settings from storage
        chrome.storage.sync.get(null, function(result) {
            var storedSettings = result;

            // set settings based on storedSettings, get default values if necessary
            var settings = {
                combo: storedSettings?.combo || _defaultCombo,
                disabledSites: storedSettings?.disabledSites || {},
                enableChat: storedSettings?.enableChat === true || storedSettings?.enableChat === undefined,
                userColor: storedSettings?.userColor || getRandomColor()
            }

            // store new settings
            chrome.storage.sync.set(settings);

            Logger.log('Settings initialized:', settings);
        });
    }
}());