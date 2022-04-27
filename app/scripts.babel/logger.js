var debug = true;
var Logger = {
    log: debug ? console.log.bind(console) : function(){}
};