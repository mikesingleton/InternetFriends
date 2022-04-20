'use strict';

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