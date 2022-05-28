let _iframe, 
    _messages,
    _timeLastSent = 0;

// post messages to the window to be recieved in the chat script
function sendMessage(messageNum, timeout) {
    if (messageNum >= _messages.length) {
        window.postMessage({ event: 'disconnected', data: { userId: 'internetfriends-welcomebot' }}, '*');
        return;
    }

    var message = _messages[messageNum];
    var elapsed = Date.now() - _timeLastSent;

    if (elapsed >= timeout) {
        // if this is a mouse move message and the elapsed time also covers the next message
        // skip this message
        if (messageNum + 1 < _messages.length &&
            message.event === 'mousemove' &&
            elapsed >= timeout + message.data.waitTime)
        {
            // add the timeout to the time last sent to simulate the skip
            _timeLastSent += timeout;
            sendMessage (++messageNum, message.data.waitTime);
            return;
        }
        
        window.postMessage(message, '*');
        _timeLastSent = Date.now();
        sendMessage (++messageNum, message.data.waitTime);
    } else {
        setTimeout(function () {
            sendMessage (messageNum, timeout);
        }, 0);
    }
}

// load json
var httpRequest = new XMLHttpRequest();
httpRequest.withCredentials = false;
httpRequest.overrideMimeType("application/json");
httpRequest.open("GET", "../../scripts/welcome-messages.json", true);
httpRequest.onreadystatechange = function() {
    if (httpRequest.readyState === 4 && httpRequest.status == "200") {
        _messages = JSON.parse(httpRequest.responseText);
        window.requestAnimationFrame(function (ts) { sendMessage(0,0,ts); });
    }
}
httpRequest.send(null);