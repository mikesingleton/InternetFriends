var debug = false;
var Logger = {
    log: debug ? console.log.bind(window.console) : function(){}
};