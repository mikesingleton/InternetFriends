var debug = false;
var Logger = {
    log: debug ? console.log.bind(console) : function(){}
};