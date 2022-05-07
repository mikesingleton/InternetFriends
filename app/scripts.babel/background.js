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
        return 'hsla(' + Math.round(Math.random() * 360) + ', 70%, 66%, 1)';
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

// ---------------------------------------- Background Script ----------------------------------------

var Background = (function() {
    // variables ----------------------------------------------------------------
    var _this = {};

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        // receive post messages from 'inject.js' and any iframes        
        if (chrome && chrome.runtime) {
            chrome.runtime.onMessage.addListener(
                function(request, sender) {
                    if (request.event === 'updateBadgeText') {
                        updateBadgeTextByTabId(sender.tab.id, request.data.peers);
                    }
                }
            );
        }

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
	function updateBadgeTextByTabId (tabId, peers) {
		chrome.action.setBadgeText(
            {
                text: peers > 0 ? peers.toString() : '',
                tabId: tabId
            }
        );
	};

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