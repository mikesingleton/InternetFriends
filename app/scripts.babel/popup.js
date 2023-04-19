'use strict';

var Popup = (function() {
    // variables ----------------------------------------------------------------
    var _this = {},
        _settingsTable = null,
        _title = null,
        _website = null,
        _websiteUrl = null,
        _enableForSite = null,
        _enableChat = null,
        _keyComboInput = null,
        _settingsTimeout = null,
        _userColor = null,
        _pauseTable = null,
        _countdownTimeout = null,
        _pausedUntil = null,
        _pausedUntilTimeout = null;

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        Logger.log('init popup');

        if (!chrome || !chrome.storage || !chrome.tabs)
           return;

        // Get document elements

        _title = document.getElementById('if-title');
        _website = document.getElementById('website');
        _enableForSite = document.getElementById('enableForSite');
        _enableChat = document.getElementById('enableChat');
        _keyComboInput = document.getElementById('keyComboInput');
        _pauseTable = document.getElementById('pauseTable');
        _settingsTable = document.getElementById('settingsTable');

        // Set website click event

        _title.addEventListener('click', function () {
            window.open('https://internetfriends.social', '_blank');
        });

        // Populate values
        
        chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
            let url = new URL(tabs[0].url);
            _websiteUrl = url ? url.host : " "
            _website.innerHTML = _websiteUrl;

            _enableForSite.checked = !IFSettings.disabledSites[_websiteUrl];
        });

        _enableChat.checked = IFSettings.enableChat;
        _keyComboInput.value = keyComboToText(IFSettings.combo);
        let userIroColor = new iro.Color(IFSettings.userColor);
        
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
        var cursorURL = typeof chrome !== "undefined" && chrome.runtime ? chrome.runtime.getURL('../../images/aero_arrow.png') : '../images/aero_arrow.png';
        _mouseBGElm.style.backgroundImage = "url(" + cursorURL + ")";
        let initColor = { h: 207, s: 86, v: 95 };
        let hsl = colorWheel.color.hsl;
        _mouseBGElm.style.filter = "hue-rotate(" + (hsl.h - initColor.h) + "deg) saturate(" + (hsl.s / initColor.s * 100) + "%)";

        colorWheel.on('color:change', function(color, changes){
            let hsl = color.hsl;
            var _mouseBGElm = document.getElementById('fakeMouse');
            _mouseBGElm.style.filter = "hue-rotate(" + (hsl.h - initColor.h) + "deg) saturate(" + (hsl.s / initColor.s * 100) + "%)";
            document.documentElement.style.setProperty('--userColor', color.rgbString);
            
            // set complementary colors
            setComplementaryColors(color);

            _userColor = color.hslaString;
            
            // use timeout to prevent settings from being updated too quickly
            if (_settingsTimeout)
                clearTimeout(_settingsTimeout);
            _settingsTimeout = setTimeout(updateUserColor, 500);
        })

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

        // Handle Pause Timer

        _pausedUntil = IFSettings.pausedUntil
        setupPauseButtons();

        // Handle Table Display

        // if currently paused
        if (_pausedUntil > Date.now()) {
            _settingsTable.classList.add("hidden");
            updateCountdown();
        } else {
            _pauseTable.classList.add("hidden");
        }
    };

    // private functions --------------------------------------------------------
    function updateUserColor () {
        chrome.storage.sync.set({'userColor': _userColor});
        chrome.runtime.sendMessage({ event: 'updateBadgeColor', data: { userColor: _userColor }});
    }

    function setComplementaryColors (iroColor) {
        var complementaryColor = new iro.Color(iroColor);
        // add 180 to get complementary color
        complementaryColor.hue += 180;
        
        // set website text color
        let websiteTextColor = pickTextColorBasedOnIroColorAdvanced(complementaryColor, 'rgba(255,255,255,1)', 'rgba(0,0,0,1)');
        document.documentElement.style.setProperty('--websiteTextColor', websiteTextColor);

        // set alpha based on saturation
        complementaryColor.alpha = .3 + (((complementaryColor.hsl.s - 50) / 50) * .2);
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
        chrome.storage.sync.set({'combo': combo});

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
        let disabledSites = IFSettings.disabledSites;
        if (event.currentTarget.checked)
            delete disabledSites[_websiteUrl];
        else
        disabledSites[_websiteUrl] = true;
        
        chrome.storage.sync.set({'disabledSites': disabledSites});
        
        var _refreshText = document.getElementById('refresh');
        _refreshText.style.visibility = "visible";
    };
    
    function onEnableChatChanged(event) {
        chrome.storage.sync.set({'enableChat': event.currentTarget.checked});
        
        var _refreshText = document.getElementById('refresh');
        _refreshText.style.visibility = "visible";
    };

    function updateCountdown() {
        var countdownTimer = document.getElementById('countdownTimer');
        const timeLeft = _pausedUntil - new Date().getTime();
        
        if (timeLeft <= 0) {
            _pauseTable.classList.add("hidden");
            _settingsTable.classList.remove("hidden");
            clearTimeout(_countdownTimeout);
        } else {
            const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
            const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

            countdownTimer.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;                
            _countdownTimeout = setTimeout(updateCountdown, 1000);
        }
    }

    function setupPauseButtons() {
        var pauseButtons = document.querySelectorAll(".pauseButton");
        var unpauseButton = document.getElementById('unpauseButton');
        
        pauseButtons.forEach(button => {
            button.addEventListener("click", function() {
                const duration = button.id === "pause15m" ? 15 * 60 * 1000 :      // 15m
                                button.id === "pause3h" ? 3 * 60 * 60 * 1000 :   // 3h
                                24 * 60 * 60 * 1000;                             // 24hr
        
                // Clear any existing countdown
                if (_countdownTimeout) {
                clearTimeout(_countdownTimeout);
                }
        
                // If extension is already paused
                if (_pausedUntil > new Date().getTime()) {
                    // Add time
                    _pausedUntil += duration
                } else {
                    // Set time
                    _pausedUntil = new Date().getTime() + duration

                    // Set refresh text
                    var _refreshText = document.getElementById('refresh');
                    _refreshText.style.visibility = "visible";
                }

                // use timeout to prevent settings from being updated too quickly
                if (_pausedUntilTimeout)
                    clearTimeout(_pausedUntilTimeout);
                _pausedUntilTimeout = setTimeout(updatePausedUntil, 100);
                _pauseTable.classList.remove("hidden");
                _settingsTable.classList.add("hidden");
        
                updateCountdown();
            });
        });

        unpauseButton.addEventListener("click", function() {
            _pausedUntil = -1
            updatePausedUntil();
            _pauseTable.classList.add("hidden");
            _settingsTable.classList.remove("hidden");
            
            var _refreshText = document.getElementById('refresh');
            _refreshText.style.visibility = "visible";
        });
    }

    function updatePausedUntil () {
        chrome.storage.sync.set({'pausedUntil': _pausedUntil});
    }

    return _this;
}());

document.addEventListener("DOMContentLoaded", function() {
    // If IFSettings have not been initialized, wait for init event to be dispatched
    if (!IFSettings) {
        IFEvents.addEventListener('settings.init', function () {
            new Popup.init();
        });
    } else {
        // else, init now
        new Popup.init();
    }
}, false);