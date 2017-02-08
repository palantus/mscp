/*
	Usage:
	new Notifier().init({text: "You clicked on " + r.test}).show();
	
	Alternatives:
	new Notifier().show("You clicked on " + r.test);
	new Notifier().show("You clicked on " + r.test, 5000);
	
	Options:
	text: The text to show
	timeout: The time that the notification should be shown. Default: 2000 ms.
	
	Notes:
		- Position: It will automatically move above a taskbar, if one exists
*/

function Notifier(){
	this.type = "Notifier";
	this.options = {};
	this.element = null;
}

Notifier.prototype.init = function(_options){
	this.options = _options;
	return this;
}

Notifier.prototype.show = function(text, timeout){
	var t = this;
	
	if(t.options.text === undefined)
		t.options.text = text;
	
	if(t.options.timeout === undefined)
		t.options.timeout = timeout;
	
	this.element = $("<div/>", {class: "notifier"});
	this.element.append(this.options.text);
	
	if($("div.tbcbar").length > 0)
		this.element.css("transform", "translate(0px,-30px)");
	
	$("body").append(this.element);
	this.element.fadeIn("fast");
	
	setTimeout(function(){
		t.element.fadeOut("fast", function(){
			t.element.remove();
		});
	}, isNaN(this.options.timeout) ? 2000 : this.options.timeout);
}