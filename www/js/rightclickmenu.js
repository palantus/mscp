/*
	Usage: 
	new RightClickMenu().init({element: div, actions: [
				{title: "Action 1", onClick: function(a, r){console.log(a.title + ", " + r.test);}},
				{title: "Action 2", onClick: function(a, r){console.log(a.title + ", " + r.test);}}
		]).attach();
		
	Additional options:
		- onClickOverride: will be called instead of onClick if set. Can be used to call onClick with specific parameters.
		- sort
		- visible: determine if an action is visibe. Can be a sync function returning true or false.
		
	onClick parameters:
		this: the RightClickMenu instance
		paramter 1: the action object
		paramter 2: the element which was right clicked
*/

function RightClickMenu(){
	this.type = "RightClickMenu";
	this.options = {};
	this.element = null;
	this.popup = null;
	this.isNested = false;
	this.startMenuMouseOutTimer = 0;
}

RightClickMenu.prototype.init = function(_options){
	this.options = _options;
	var t = this;
	return this;
}

RightClickMenu.prototype.attach = function(){
	var t = this;
	if(typeof(this.options.elementRef) === "string")
		this.element = $("#" + this.options.elementRef);
	else if(typeof(this.options.element) === "object")
		this.element = this.options.element;

	if(!this.element)
		console.log("ERROR: No element for RightClickMenu options");
		
	this.element.on("contextmenu", function(e){
		if(e.button === 2){
			t.show(e);
			e.preventDefault();
		}
	});
}

RightClickMenu.prototype.show = function(e){
	var t = this;
		
	var content = [];
	if($.isArray(t.options.actions)){

		if(t.options.sort === true)
			t.options.actions = t.options.actions.sort(function(a, b){return a.title < b.title ? -1 : 1;});

		for(var i = 0; i < t.options.actions.length; i++){
			if(t.options.actions[i].visible === false || (typeof(t.options.actions[i].visible) === "function" && !t.options.actions[i].visible.call(t)))
				continue;
		
			var link = $("<div/>", {class: "rcmitem", html: t.options.actions[i].title});
			link.data("rcmitem", t.options.actions[i]);
			link.click(function(e){
				var rcmItemData = $(this).data("rcmitem");
				if(typeof(t.options.onClickOverride) === "function") //In case we need to override the onClick event to customize parameters - TC is using it!
					t.options.onClickOverride.call(t, rcmItemData, t.element);
				else if(typeof(rcmItemData.onClickOverride) === "function") //In case we need to override the onClick event to customize parameters - TC is using it!
					rcmItemData.onClickOverride.call(t, rcmItemData, t.element);
				else if(typeof(rcmItemData.onClick) === "function")
					rcmItemData.onClick.call(t, rcmItemData, t.element);
				t.popup.close();
			});
			content.push(link);
		}
	} else {
		content.push($("<div/>", {html: "No actions available"}));
	}
	
	this.popup = new PopupCreator();
	this.popup.init({
							centerH: false,
							centerV: false,
							allowMinimize: false, allowMaximize: false, allowClose: false,
							contentStyle: {padding: "0px", margin: "0px"},
							showInTaskbar: false,
							moveable: false,
							resizable: false,
							openUnderCursor: false,
							style: {
								left : e.pageX + "px", 
								top: e.pageY + "px",
								"min-width": "50px",
								"min-height": "20px"
							},
							content: content
						  });  
	this.popup.show();
	
		
	this.popup.element.mouseleave(function(){
		t.startMenuMouseOutTimer = setTimeout(function(){
			if(t.popup != null)
				t.popup.close();
		}, 300);
	});
	
	this.popup.element.mouseenter(function(){
		clearTimeout(t.startMenuMouseOutTimer);
	});
}