'use strict';

var Popup = (function() {
    // variables ----------------------------------------------------------------
    var _this = {},
        _website = null,
        _enableForSite = null,
        _enableChat = null,
        _keyComboInput = null,
        _storedSettings = null,
        _defaultCombo = {
            ctrlKey: true,
            shiftKey: true,
            altKey: false,
            key: "Enter"
        };

    // initialize ---------------------------------------------------------------
    _this.init = function() {
        Logger.log('init popup');
        
        //if (!chrome || !chrome.storage || !chrome.tabs)
        //    return;

        // Get document elements

        _website = document.getElementById('website');
        _enableForSite = document.getElementById('enableForSite');
        _enableChat = document.getElementById('enableChat');
        _keyComboInput = document.getElementById('keyComboInput');

        // Get chrome information
        
        // chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
        //     let url = new URL(tabs[0].url);
        //     _website.innerHTML = url ? url.host : " ";
        // });

        // chrome.storage.sync.get(['if-settings'], function(result) {
        //     console.log('Value currently is ' + result);
        // });

        // Populate values

        _enableForSite.checked = true;
        _enableChat.checked = true;
        _keyComboInput.value = keyComboToText(_defaultCombo);

        // Register Event Listeners

        document.addEventListener("keydown", dom_onKeydown, false);
        document.addEventListener("keyup", dom_onKeydown, false);

        // Store values

        _storedSettings = {
            combo: _defaultCombo,
            disabledSites: [],
            enableChat: _enableChat.checked
        }

        // chrome.storage.sync.set({'if-settings': _storedSettings}, function() {
        //     console.log('Value is set to ' + _storedSettings);
        // });

        // Init ColorWheel

        var colorWheel = new iro.ColorPicker("#colorWheelDemo", {
            width: 100,
            padding: -4,
            color: '#2196f3',
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

        colorWheel.on('color:change', function(color, changes){
            let init = { h: 207, s: 86, v: 95 };
            let hsv = color.hsv;
            var _mouseBGElm = document.getElementById('fakeMouse');
            _mouseBGElm.style.filter = "hue-rotate(" + (hsv.h - init.h) + "deg) saturate(" + (hsv.s / init.s * 100) + "%)";
        })
    };

    // private functions --------------------------------------------------------
    function dom_onKeydown(event) {
        if (!_keyComboInput || _keyComboInput !== document.activeElement)
            return;
            
        event.preventDefault();

        var keyCode = event.which || event.keyCode;
        var key = event.key;
        var shiftKey = event.shiftKey;
        var ctrlKey = event.ctrlKey;
        var altKey = event.altKey;
        var combo = { key, keyCode, shiftKey, ctrlKey, altKey };
        
        _keyComboInput.value = keyComboToText(combo);

        if (key === "Control" || key === "Shift" || key === "Alt")
            return;

        _keyComboInput.blur();
    };

    function keyComboToText({ key, shiftKey, ctrlKey, altKey }) {
        if (!key) return "";

        return (ctrlKey ? "Ctrl + " : "") +
            (altKey ? "Alt + " : "") +
            (shiftKey ? "Shift + " : "") +
            ((key !== "Control" && key !== "Shift" && key !== "Alt") ? key : "");
    }

    return _this;
}());

document.addEventListener("DOMContentLoaded", function() { new Popup.init(); }, false);