'use strict';

var Popup = (function() {
    // variables ----------------------------------------------------------------
    var _this = {},
        _website = null,
        _websiteUrl = null,
        _enableForSite = null,
        _enableChat = null,
        _keyComboInput = null,
        _storedSettings = null,
        _settings = null,
        _settingsTimeout = null,
        _defaultCombo = {
            ctrlKey: true,
            shiftKey: true,
            altKey: false,
            key: "Enter"
        };

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        Logger.log('init popup');
        
        if (!chrome || !chrome.storage || !chrome.tabs)
           return;

        // Get document elements

        _website = document.getElementById('website');
        _enableForSite = document.getElementById('enableForSite');
        _enableChat = document.getElementById('enableChat');
        _keyComboInput = document.getElementById('keyComboInput');

        // Get chrome information
        
        chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
            let url = new URL(tabs[0].url);
            _websiteUrl = url ? url.host : " "
            _website.innerHTML = _websiteUrl;
        });
        
        // Store values
        
        chrome.storage.sync.get(['if-settings'], function(result) {
            Logger.log('Stored Settings:');
            _storedSettings = result['if-settings'];
            Logger.log(_storedSettings);
            
            _settings = {
                combo: _storedSettings?.combo || _defaultCombo,
                disabledSites: _storedSettings?.disabledSites || {},
                enableChat: _storedSettings?.enableChat === true || _storedSettings?.enableChat === undefined,
                userColor: _storedSettings?.userColor || getRandomIroColor()
            }

            chrome.storage.sync.set({'if-settings': _settings}, function() {
                Logger.log('Set Settings:');
                Logger.log(_settings);
            });
            
            // Populate values

            _enableForSite.checked = !_settings.disabledSites[_websiteUrl];
            _enableChat.checked = _settings.enableChat;
            _keyComboInput.value = keyComboToText(_settings.combo);
            let userIroColor = new iro.Color(_settings.userColor);
            
            // validate
            userIroColor.value = 90;
            if (userIroColor.saturation < 50)
                userIroColor.saturation = 50;

            document.documentElement.style.setProperty('--userColor', userIroColor.rgbString);

            // set complementary colors
            setComplementaryColors(userIroColor);

            // Init ColorWheel

            var colorWheel = new iro.ColorPicker("#colorWheelDemo", {
                width: 100,
                padding: -4,
                color: userIroColor,
                layout: [
                    { 
                    component: iro.ui.Wheel,
                    options: {} 
                    }
                ]
            });
            
            var _mouseBGElm = document.getElementById('fakeMouse');
            var cursorURL = typeof chrome !== "undefined" && chrome.extension ? chrome.extension.getURL('../../images/aero_arrow.png') : '../images/aero_arrow.png';
            _mouseBGElm.style.backgroundImage = "url(" + cursorURL + ")";
            let initColor = { h: 207, s: 86, v: 95 };
            let hsv = colorWheel.color.hsv;
            _mouseBGElm.style.filter = "hue-rotate(" + (hsv.h - initColor.h) + "deg) saturate(" + (hsv.s / initColor.s * 100) + "%)";

            colorWheel.on('color:change', function(color, changes){
                let hsv = color.hsv;
                var _mouseBGElm = document.getElementById('fakeMouse');
                _mouseBGElm.style.filter = "hue-rotate(" + (hsv.h - initColor.h) + "deg) saturate(" + (hsv.s / initColor.s * 100) + "%)";
                document.documentElement.style.setProperty('--userColor', color.rgbString);
                
                // set complementary colors
                setComplementaryColors(color);

                _settings.userColor = color.hsva;
                
                // use timeout to prevent settings from being updated too quickly
                if (_settingsTimeout)
                    clearTimeout(_settingsTimeout);
                _settingsTimeout = setTimeout(updateSettings, 500);
            })
        });

        // Register Event Listeners

        document.addEventListener("keydown", dom_onKeydown, false);
        document.addEventListener("keyup", dom_onKeydown, false);

        _enableForSite.addEventListener("change", onEnableForSiteChanged);
        _enableChat.addEventListener("change", onEnableChatChanged);
        
        // Handle Color Wheel Popup

        var _cursorColorButton = document.getElementById('cursorColorButton');
        var _colorWheelContainerBackground = document.getElementById('colorWheelContainerBackground');

        _cursorColorButton.addEventListener("click", onCursorButtonClicked);
        _colorWheelContainerBackground.addEventListener("click", onPopupContainerClicked);
    };

    // private functions --------------------------------------------------------
    function updateSettings () {
        chrome.storage.sync.set({'if-settings': _settings}, function() {
            Logger.log('Set Settings:');
            Logger.log(_settings);
        })
        
        var _refreshText = document.getElementById('refresh');
        _refreshText.style.visibility = "visible";
    }

    function getRandomIroColor () {
        var iroColor = new iro.Color('{a: 1, h: 0, s: 70, v: 90}');
        iroColor.hue += Math.random() * 360;
        return iroColor.hsva;
    }

    function setComplementaryColors (iroColor) {
        var complementaryColor = new iro.Color(iroColor);
        // add 180 to get complementary color
        complementaryColor.hue += 180;
        
        // set website text color
        let websiteTextColor = pickTextColorBasedOnIroColorAdvanced(complementaryColor, 'rgba(255,255,255,1)', 'rgba(0,0,0,1)');
        document.documentElement.style.setProperty('--websiteTextColor', websiteTextColor);

        // set alpha based on saturation
        complementaryColor.alpha = .2 + (((complementaryColor.hsv.s - 50) / 50) * .8);
        document.documentElement.style.setProperty('--compUserColorLight', complementaryColor.rgbaString);

        // darken
        complementaryColor.value -= 20;
        document.documentElement.style.setProperty('--compUserColorDark', complementaryColor.rgbString);

        // darken user color
        var userColorDark = new iro.Color(iroColor);
        userColorDark.value -= 20;
        document.documentElement.style.setProperty('--userColorDark', userColorDark.rgbString);
    }

    function pickTextColorBasedOnIroColorAdvanced(iroColor, lightColor, darkColor) {
        var uicolors = [iroColor.red / 255, iroColor.green / 255, iroColor.blue / 255];
        var c = uicolors.map((col) => {
          if (col <= 0.03928) {
            return col / 12.92;
          }
          return Math.pow((col + 0.055) / 1.055, 2.4);
        });
        var L = (0.2126 * c[0]) + (0.7152 * c[1]) + (0.0722 * c[2]);
        return (L > 0.179) ? darkColor : lightColor;
      }

    function dom_onKeydown(event) {
        if (!_keyComboInput || _keyComboInput !== document.activeElement)
            return;
            
        event.preventDefault();

        var key = event.key;
        var shiftKey = event.shiftKey;
        var ctrlKey = event.ctrlKey;
        var altKey = event.altKey;
        var combo = { key, shiftKey, ctrlKey, altKey };
        
        _keyComboInput.value = keyComboToText(combo);

        // if pressing part of the combo, return so the rest of the combo can be pressed
        if (key === "Control" || key === "Shift" || key === "Alt")
            return;

        // combo complete, set combo and blur input
        _settings.combo = combo;
        
        chrome.storage.sync.set({'if-settings': _settings}, function() {
            Logger.log('Set Settings:');
            Logger.log(_settings);
        });

        _keyComboInput.blur();
    };

    function keyComboToText({ key, shiftKey, ctrlKey, altKey }) {
        if (!key) return "";

        return (ctrlKey ? "Ctrl + " : "") +
            (altKey ? "Alt + " : "") +
            (shiftKey ? "Shift + " : "") +
            ((key !== "Control" && key !== "Shift" && key !== "Alt") ? key : "");
    };

    function onCursorButtonClicked(event) {
        var _colorWheelContainer = document.getElementById('colorWheelContainer');
        _colorWheelContainer.style.visibility = "visible";
    };

    function onPopupContainerClicked(event) {
        var _colorWheelContainer = document.getElementById('colorWheelContainer');
        _colorWheelContainer.style.visibility = "hidden";
    };
    
    function onEnableForSiteChanged(event) {    
        if (event.currentTarget.checked)
            delete _settings.disabledSites[_websiteUrl];
        else
            _settings.disabledSites[_websiteUrl] = true;
        
        chrome.storage.sync.set({'if-settings': _settings}, function() {
            Logger.log('Set Settings:');
            Logger.log(_settings);
        });
        
        var _refreshText = document.getElementById('refresh');
        _refreshText.style.visibility = "visible";
    };
    
    function onEnableChatChanged(event) {
        _settings.enableChat = event.currentTarget.checked;
        
        chrome.storage.sync.set({'if-settings': _settings}, function() {
            Logger.log('Set Settings:');
            Logger.log(_settings);
        });
        
        var _refreshText = document.getElementById('refresh');
        _refreshText.style.visibility = "visible";
    };

    return _this;
}());

document.addEventListener("DOMContentLoaded", function() { new Popup.init(); }, false);