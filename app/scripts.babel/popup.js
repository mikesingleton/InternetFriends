'use strict';

var Popup = (function() {
    // variables ----------------------------------------------------------------
    var _this = {},
        _title = null,
        _website = null,
        _websiteUrl = null,
        _enableForSite = null,
        _enableChat = null,
        _keyComboInput = null,
        _settingsTimeout = null,
        _userColor = null,
        _pauseButtons = null;

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
        _pauseButtons = document.querySelectorAll(".pauseButton");

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

        setupPauseButtons();
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

    function setupPauseButtons() {
        _pauseButtons.forEach(button => {
            button.addEventListener("click", function() {
              const duration = button.id === "pause15m" ? 15 * 60 * 1000 :      // 15m
                               button.id === "pause3h" ? 3 * 60 * 60 * 1000 :   // 3h
                               24 * 60 * 60 * 1000;                             // 24hr
        
              // Clear any existing countdown
              if (countdown) {
                clearTimeout(countdown);
              }
        
              const endTime = new Date().getTime() + duration;
              timerContainer.classList.remove("hidden");
        
              // Update the countdown timer
              function updateCountdown() {
                const timeLeft = endTime - new Date().getTime();
                
                if (timeLeft <= 0) {
                  timerContainer.classList.add("hidden");
                  clearTimeout(countdown);
                } else {
                  const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                  const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                  const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
        
                  countdownTimer.textContent = `${hours}h ${minutes}m ${seconds}s`;
                  countdown = setTimeout(updateCountdown, 1000);
                }
              }
        
              updateCountdown();
            });
          });
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