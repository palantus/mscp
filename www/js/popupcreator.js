 //TODO: skal tage højde for om opsætning gemmes i stedet for at tjekke på x i fixPosition
/*
var popupCreator = new PopupCreator();
popupCreator.init({
						title: "My first popup",
						tabs:
							[
								{title: "Tab 1", content: "<h1>Tab 1 content</h1>"},
								{title: "Tab 2", content: tableCreator, onShow: function(element, idx){}}
							]
					});
popupCreator.show(callback);

options:
- onClose
- hideOnClose
- modal
- onShow
- onBeforeShow
- tableCreator
- center (controls both centerH and centerV)
- centerH
- centerV
- showInTaskbar
- openUnderCursor
- rightClickMenu
- initialTab: index of the first tab shown
- allowMaximize
- allowMinimize
- allowClose
- moveable

API:
- maximize
- hide
- isVisible
- print: Call with cssStyles to override the style. For instance:
	popupCreator.print({".forumpost": {"border-top": "1px solid black", "margin-top": "10px"}});

Content can be defined as either:
 - content
 - contentExternal
 - contentIFrame

*/

var clickHandlerRegisteredForTableCreator = false;
var lastDocumentClickLoaction = {x:0,y:0};

function PopupCreator(){
	this.type = "TableCreator";
	this.options = {};
	this.tab = 0;
	this.element = null;
	this.minimizedElement = null;
	this.moveStartOffsetX = 0;
	this.moveStartOffsetY = 0;
	this.resizeStartX = 0;
	this.resizeStartY = 0;
	this.resizeStartWidth = 0;
	this.resizeStartHeight = 0;
	this.minHeight = 0;
	this.isHidden = false;
	this.isLoading = false;
	this.cachedSetup = {};
	this.contentObjects = [];
	this.keepMinimizedLink = false;
	this.startMaximized = false;
}

PopupCreator.prototype.init = function(_options){
	this.options = _options;

	if(typeof(Storage)!=="undefined" && this.options.typeId !== undefined){
		if(localStorage.PopupCreatorCachedSetup === undefined)
			localStorage.PopupCreatorCachedSetup = JSON.stringify({});

		this.cachedSetup = JSON.parse(localStorage.PopupCreatorCachedSetup)[this.options.typeId];
		if(this.cachedSetup === undefined)
			this.cachedSetup = {};
	}

	var t = this;
	$(document).keydown(function(e) {
		if(t === undefined || t.element === undefined){
			t = undefined;
			return;
		}

		if (e.keyCode == 27) { //ESC
			if(t.allowClose !== false && t.isVisible() && parseInt(t.element.css("z-index")) == t.getHighestZIndex())
				t.close();
		}
	});

	this.element = $("<div class='pcpopup'></div>");
	$("body").append(this.element);

	// Move to the top on mouse down
	this.element.mousedown(function(){
		t.focus();
	});

	//Append overlay
	if(this.options.modal === true && $("body").find(".pcoverlay").length <= 0){
		$("body").append("<div class='pcoverlay'></div>");
		if(this.options.allowClose){
			$("body").find(".pcoverlay").click(function(){
				t.close();
			});
		}
	}

	if(!clickHandlerRegisteredForTableCreator){
		$(document).click(function(e){
			lastDocumentClickLoaction = {x: e.clientX, y: e.clientY};
		});
		clickHandlerRegisteredForTableCreator = true;
	}

	return this;
}

PopupCreator.prototype.focus = function(){
	this.element.css("z-index", this.getHighestZIndex() + 1);
}

PopupCreator.prototype.hasFocus = function(){
	return this.getHighestZIndex() == parseInt(this.element.css("z-index"));
}

PopupCreator.prototype.getHighestZIndex = function(){
	var index_highest = 0;
	$("div.pcpopup").each(function() {
		var index_current = parseInt($(this).css("zIndex"), 10);
		if(index_current > index_highest) {
			index_highest = index_current;
		}
	});
	return index_highest;
}

PopupCreator.prototype.show = function(callback){
	var t = this;

	this.startMaximized = this.options.maximize === true || this.cachedSetup.isMaximized === true;

	this.element.css("z-index", this.getHighestZIndex() + 1);

	//Check if the element is maximized or minimized - in that case, just restore it
	if(this.restore())
		return;

	//If already visible - just return;
	if(this.element.is(":visible")){
		return;
	} else if(this.isHidden === true){
		t.isHidden = false;
		this.element.fadeIn(100, function(){
		});
		return;
	}

	//var tmpNum = $("#" + this.options.elementId + " div.pcheader select").val();

	var top = $("<div/>", {"class": "pctopdiv pcinner"});

	var mousewheelevt=(/Firefox/i.test(navigator.userAgent))? "DOMMouseScroll" : "mousewheel" //FF doesn't recognize mousewheel as of FF3.x
	top.on(mousewheelevt, function(e){
		var factor = t.element.width() / Math.max(0.01, t.element.height());
		var data=(/Firefox/i.test(navigator.userAgent))? e.originalEvent.detail : e.originalEvent.wheelDelta;
		if(data/120 > 0) { //Up
			t.element.width(Math.max(250, parseInt(t.element.width()) + (factor * 30)));
			t.element.height(Math.max(100, parseInt(t.element.height()) + (factor * 30)));
		} else {
			t.element.width(Math.max(250, parseInt(t.element.width()) - (factor * 30)));
			t.element.height(Math.max(100, parseInt(t.element.height()) - (factor * 30)));
		}
		t.fixSizing();
	});

	top.dblclick(function(e){
		if(e.button == 0){
			if(t.element.hasClass("pcpopupmaximized"))
				t.restore();
			else
				t.maximize();
		}
	});

	top.bind('mouseup', function(e){
		if(e.which == 2){
			t.close();
		}
	});

	// TITLE
	if(this.options.title !== undefined){
		var titleDiv = $("<div class='pctitle' unselectable='on' onselectstart='return false;' onmousedown='return false;'>" + this.options.title + "</div>");
		top.append(titleDiv);

		if(typeof(RightClickMenu) === "function")
			new RightClickMenu().init(jQuery.extend(true, {element: titleDiv}, this.options.rightClickMenu)).attach();
	}

	//TABS
	if($.isArray(this.options.tabs)){
		var tabs = $("<div class='pctabs'></div>");
		for(var tab = 0; tab < this.options.tabs.length; tab++){
			//var titleButton = $("<button class='pctabtitle'>" + this.options.tabs[tab].title + "</button>");
			var titleButton = $("<button class='pctabtitle'></button>");

			titleButton.data("tabnum", tab);
			titleButton.mousedown(function(e){
				e.preventDefault();
				return false;
			});
			titleButton.click(function(){
				var tabNum = $(this).data("tabnum");
				t.setTab(tabNum, function(){
					t.fixSizing();
				});
			});

			tabs.append(titleButton);
		}
		top.append(tabs);

		setTimeout(function(){
			t.refreshTabTitles();
		}, 1);
	}


	var buttons = $("<div/>", {"class": "pctopctlbtns pcinner"});

	// MINIMIZE
	if(this.options.allowMinimize !== false){
		var minimizeBtn = $("<img src='/mscp/img/min.png' class='pcminimizebtn pctoprighticon' title='Minimize'></img>");
		minimizeBtn.click(function(){
			t.minimize();
		});
		buttons.append(minimizeBtn);
	}

	//MAXIMIZE
	if(this.options.allowMaximize !== false){
		if(window.isMobile()){
			this.element.addClass("pcpopupmaximized");
		} else {
			this.maximizeBtn = $("<img src='/mscp/img/max.png' class='pcmaximizebtn pctoprighticon' title='Maximize'></img>");
			this.restoreBtn = $("<img src='/mscp/img/windowed.png' class='pcmaximizebtn pctoprighticon' title='Restore'></img>");
			if(this.startMaximized)
				this.maximizeBtn.hide();
			else
				this.restoreBtn.hide();

			this.maximizeBtn.click(function(){t.maximize();});
			this.restoreBtn.click(function(){t.restore();});
			buttons.append(this.maximizeBtn);
			buttons.append(this.restoreBtn);
		}
	}

	// CLOSE
	if(this.options.allowClose !== false){
		var closeBtn = $("<img src='/mscp/img/close.png' class='pcclosebtn pctoprighticon' title='Close'></img>");
		closeBtn.click(function(){
			t.close();
		});
		buttons.append(closeBtn);
	}

	if(top.children().length > 0 || buttons.children().length > 0){
		this.element.append(top);
		this.element.append(buttons);
	}

	var initialTab = 0;
	if(!isNaN(this.options.initialTab))
		initialTab = this.options.initialTab;

	if(this.options.tabs !== undefined){
		this.setTab(initialTab, function(){
			t.contentLoaded(callback);
		});
	} else {
		var contentNode = $("<div class='pccontent pcinner'></div>");
		if(this.options.contentStyle !== undefined)
			contentNode.css(this.options.contentStyle);
		this.appendContent(contentNode, null, function(){
			t.contentLoaded(callback);
		});
	}
}

PopupCreator.prototype.contentLoaded = function(callback){
	var t = this;

	if(this.options.style !== undefined)
		this.element.css(this.options.style);

	if(this.options.moveable !== false)
		this.makeMovable();
	if(this.options.resizable !== false)
		this.makeResizable();

	if(this.cachedSetup.width !== undefined && this.cachedSetup.width > 20)
		this.element.css("width", this.cachedSetup.width + "px");
	if(this.cachedSetup.height !== undefined && this.cachedSetup.height > 50)
		this.element.css("height", this.cachedSetup.height + "px");
	if(this.cachedSetup.x !== undefined)
		this.element.css("left", this.cachedSetup.x + "px");
	if(this.cachedSetup.y !== undefined)
		this.element.css("top", this.cachedSetup.y + "px");

	if(this.options.modal === true)
		$("body").find(".pcoverlay").fadeIn(100);

	if(this.startMaximized && !window.isMobile()) //TODO: fix - too expensive to call fixSizing in maximize.... Should set height
		//this.element.addClass("pcpopupmaximized");
		this.maximize();

	if(window.isMobile() && this.options.allowMaximize !== false)
		this.element.height($(window).height() - $("div.tbcbar").height());

	this.element.append($("<div/>", {"class": "pcresizehover"}));

	setTimeout(function(){
		if(typeof(t.options.onBeforeShow) === "function")
			t.options.onBeforeShow.call(t);

		t.fixPosition();


		t.isLoading = true;
		setTimeout(function(){t.isLoading = false;}, 500);
		setTimeout(function(){t.fixSizing();}, 1);

		if(window.isMobile()){
			t.element.show();
			t.afterShow(callback);
		} else {
			t.element.fadeIn({duration: 100, complete: function(){
				t.afterShow(callback);
			}});
		}
	}, 1);

	if(this.options.showInTaskbar !== false){
		var minTabs = $("div.tbctasks");
		if(minTabs.length > 0){
			this.addTaskIcon();
			this.keepMinimizedLink = true;
		}
	}
}

PopupCreator.prototype.refreshTabTitles = function(){
	var t = this;
	this.element.find(".pctabtitle").each(function(idx, ele){
		t.refreshTabTitle(idx, ele, t.options.tabs[idx].title);
	});
}

PopupCreator.prototype.refreshTabTitle = function(idx, element, title){
	var t = this;
	if(typeof(title) === "function"){
		title.call(t, function(newTitle){
			$(element).html(newTitle);
		});
	} else {
		$(element).html(title);
	}
}

PopupCreator.prototype.afterShow = function(callback){
	var t = this;

	this.element.css("height", this.element.height() + "px");

	this.fixSizing();

	$(window).resize(function () {t.fixSizing();});

	if(typeof(callback) === "function")
		callback.call(this);
	if(typeof(this.options.onShow) === "function")
		this.options.onShow.call(this);
}

PopupCreator.prototype.fixSizing = function(){
	var title = this.element.find(".pctitle");
	var buttons = this.element.find(".pctopctlbtns");

	//Set original title width, so that it doesn't change when we change it below...
	if(!this.titleWidth)
		this.titleWidth = title.width();

	if(this.titleWidth > this.element.width() - buttons.width() - 30){
		var win = this.element.width();
		var titleOuters = title.position().left + (title.outerWidth() - title.width());
		title.css("width", (win - buttons.width() - titleOuters) + "px");
	} else {
		title.css("width", "");
	}

	var subtractHeight = $("div.tbcbar").height();

	if(this.element.hasClass("pcpopupmaximized")){
		this.element.height($(window).height() - $("div.tbcbar").height());
	} else if(!window.isMobile()){

		if(this.element.width() > $(window).width())
			this.element.css("width", $(window).width());
		if(this.element.height() > $(window).height())
			this.element.css("height", $(window).height());


		/* Move windows above the screen down */
		if(this.element.position().top < 0)
			this.element.css("top", "0px");

		/* Move windows below the screen up */
		if(this.element.position().top > $(window).height() - 60 - subtractHeight)
			this.element.css("top", $(window).height() - 60 - subtractHeight);

		if(this.element.position().left < 0)
			this.element.css("left", 0);

		if(this.element.position().left > $(window).width() - this.element.width())
			this.element.css("left", $(window).width() - this.element.width());

		/* FIX in case that the bottom of the dialog is below the screen */
		if(this.element.outerHeight() + this.element.position().top > $(window).height() - subtractHeight)
			this.element.height($(window).height() - this.element.position().top - 2 - subtractHeight); // 2 for top and bottom borders
	}

	/* FIX content to have the proper height */
	var c = this.element.find(".pccontent:visible");
	if(c.length > 0){
		var t = this.element.innerHeight() ;
		t -= c.position().top ;
		t -= parseInt(c.css("padding-top")) | 0 ;
		t -= parseInt(c.css("padding-bottom")) | 0 ;
		t -= parseInt(c.css("margin-bottom")) | 0 ;
		t -= parseInt(c.css("margin-top")) | 0;
		t -= parseInt(c.css("border-top")) | 0;
		c.height(t);
	}
}

PopupCreator.prototype.fixPosition = function(){
	if(this.options.centerH !== false && this.cachedSetup.x === undefined)
		this.element.css("left", ($(window).width()/2) - (this.element.width()/2));

	if(this.options.centerV === true && this.cachedSetup.x === undefined)
		this.element.css("top", ($(window).height()/2) - (this.element.height()/2));

	if(lastDocumentClickLoaction !== undefined && this.options.openUnderCursor !== false && this.cachedSetup.x === undefined && !this.options.centerH && !this.options.centerV){
		var x = Math.min($(window).width()  - this.element.width(), 	Math.max(0, lastDocumentClickLoaction.x - (this.element.width()/2)));
		var y = Math.min($(window).height() - this.element.height(), 	Math.max(0, lastDocumentClickLoaction.y - (Math.min(50, this.element.height()/3))));
		this.element.css("left", x);
		this.element.css("top", y);
	}
}

PopupCreator.prototype.makeMovable = function(){
	/*var element = this.element.find(".pctopdiv");
	if(element.length > 0){*/
	var element = this.element;
	{
		var t = this;
		var divMove = function(e){
			t.element.offset({ top: e.clientY - t.moveStartOffsetY, left: e.clientX - t.moveStartOffsetX });
		}

		element[0].addEventListener('mousedown', function(e){

			if(e.button == 0
					&& (/*$(e.target).hasClass("pccontent") Causes click on scrollbar to fade the window out...
					||  */$(e.target).hasClass("pctopdiv")
					||  $(e.target).hasClass("pcpopup")
					||  $(e.target).parents(".pctopdiv").length > 0))
			{
				if(!t.element.hasClass("pcpopupmaximized")) {
					t.moveStartOffsetX = e.clientX - t.element.position().left;
					t.moveStartOffsetY = e.clientY - t.element.position().top;
					t.element.css({	"position": 'absolute'});
					//t.element.find(".pccontent").hide();
				}

				t.element.addClass("pcpopupmoving");
				window.addEventListener('mousemove', divMove, true);
				e.preventDefault(); //Extremly important - otherwise the drag will select elements on the page!
			}
		}, false);
		window.addEventListener('mouseup', function(e){
			window.removeEventListener('mousemove', divMove, true);
			if(t !== undefined && t.element !== undefined)
				t.element.removeClass("pcpopupmoving");
			else
				t = undefined;
			//t.element.find(".pccontent").show();
		}, false);
	}
}

PopupCreator.prototype.makeResizable = function(){
	var t = this;
	var divMove = function(e){
		t.element.css({	"position": 'absolute',
						"height": Math.max(t.minHeight, (t.resizeStartHeight + (e.clientY - t.resizeStartY))) + 'px',
						"width": (t.resizeStartWidth + (e.clientX - t.resizeStartX)) + 'px'});
		e.preventDefault();
		t.fixSizing();
	}

	this.element[0].addEventListener('mousedown', function(e){
		t.resizeStartX = e.pageX;
		t.resizeStartY = e.pageY;
		t.resizeStartHeight = t.element.height();
		t.resizeStartWidth = t.element.width();
		t.minHeight = Math.max(t.element.find(".pccontent:visible").position().top + 21, t.element.find(".pctopdiv").height());

		var dialogClickedX = (t.resizeStartX - t.element.position().left) - (parseInt(t.element.css("margin-left")) | 0);
		var dialogClickedY = (t.resizeStartY - t.element.position().top) - (parseInt(t.element.css("margin-top")) | 0);

		if(dialogClickedX > t.element.width() - 15 && dialogClickedY > t.element.height() - 15){
			if(!t.element.hasClass("pcpopupmaximized")){
				window.addEventListener('mousemove', divMove, true);
			}
			e.preventDefault();
		}
	}, false);
    window.addEventListener('mouseup', function(e){
		window.removeEventListener('mousemove', divMove, true);
	}, false);
}

PopupCreator.prototype.setTab = function(tabNum, callback){
	var t = this;
	var onComplete = function(){
		t.element.find("button.pctabtitle").removeClass("pctabtitlecurrent");
		t.element.find("button.pctabtitle:nth-child(" + (tabNum+1) + ")").addClass("pctabtitlecurrent");

		if(t.options.tabs !== undefined && typeof(t.options.tabs[tabNum].onShow) === "function")
			t.options.tabs[tabNum].onShow.call(t, t.options.tabs[tabNum].content, tabNum);

		if(typeof(callback) === "function")
			callback.call(t);
	}

	var content = this.options.tabs[tabNum].content;
	this.element.find(".pccontent").hide();
	var newTabExisting = this.element.find(".pccontent[data-tabnum=\"" + tabNum + "\"]");

	if(newTabExisting.length > 0) {
		newTabExisting.show();
		this.fixSizing();
		onComplete();
	} else {
		var contentNode = $("<div class='pccontent pcinner'></div>");
		contentNode.attr("data-tabnum", ""+tabNum);

		if(this.options.tabs[tabNum].style !== undefined)
			contentNode.css(this.options.tabs[tabNum].style);

		this.appendContent(contentNode, tabNum, function(){
			onComplete();
		});
	}
}

PopupCreator.prototype.appendContent = function(contentNode, tabNum, callback){
	var t = this;
	var content = this.options.tabs !== undefined ? this.options.tabs[tabNum].content : this.options.content;
	var contentExternal = this.options.tabs !== undefined ? this.options.tabs[tabNum].contentExternal : this.options.contentExternal;
	var contentIFrame = this.options.tabs !== undefined ? this.options.tabs[tabNum].contentIFrame : this.options.contentIFrame;

	if(content !== undefined){
		var contentArray = $.isArray(content) ? content : [content];
		for(var i = 0; i < contentArray.length; i++){
			if(typeof(contentArray[i]) === "object" && contentArray[i].type === "TableCreator"){
				var id = "pctc" + i + "" + new Date().getTime();
				var tabElement = $("<div id='" + id + "'></div>");
				contentNode.append(tabElement);
				this.element.append(contentNode);
				var tc = new TableCreator();

				var newObj = jQuery.extend(true, {}, contentArray[i]); //Create a deep copy
				newObj.elementId = id;
				tc.init(newObj);
				tc.popupCreator = this;
				tc.draw(function(){if(t.isLoading) t.fixPosition();});
				this.contentObjects[i] = tc;
			} else if(typeof(contentArray[i]) === "object" && contentArray[i].type === "SearchBar"){
				var id = "pcsb" + i + "" + new Date().getTime();
				var tabElement = $("<div id='" + id + "'></div>");
				contentNode.append(tabElement);
				this.element.append(contentNode);
				var sb = new SearchBar();

				var newObj = jQuery.extend(true, {}, contentArray[i]); //Create a deep copy
				newObj.elementRef = id;
				sb.init(newObj);
				sb.popupCreator = this;
				sb.show();
				this.contentObjects[i] = sb;
			} else if(typeof(contentArray[i]) === "object" && contentArray[i].type === "DesktopCreator"){
				var id = "pcdc" + i + "" + new Date().getTime();
				var tabElement = $("<div id='" + id + "'></div>");
				contentNode.append(tabElement);
				this.element.append(contentNode);
				var sb = new DesktopCreator();

				var newObj = jQuery.extend(true, {}, contentArray[i]); //Create a deep copy
				newObj.elementRef = id;
				sb.init(newObj);
				sb.popupCreator = this;
				sb.show();
				this.contentObjects[i] = sb;
			} else {
				contentNode.append(contentArray[i]);
				this.element.append(contentNode);
			}
		}
		callback();
	}
	else if(contentExternal !== undefined){
		/*
		var contentExternalArray = $.isArray(contentExternal) ? contentExternal : [contentExternal];
		for(var i = 0; i < contentExternalArray.length; i++){
			if(typeof(contentExternalArray[i]) === "string") {
				contentNode.load(contentExternalArray[i], function(){
					t.element.append(contentNode);
					//t.fixSizing();
					callback();
				});
			}
		}
		*/
		if(typeof(contentExternal) === "string") {
			contentNode.load(contentExternal, function(){
				t.element.append(contentNode);
				//t.fixSizing();
				callback();
			});
		}
	}
	else if(contentIFrame!== undefined){
		if(typeof(contentIFrame) === "string") {
			var frame = $("<iframe/>", {src: contentIFrame, class: "pccontent"});
			t.element.append(frame);
			this.contentObjects[i] = frame;
			callback();
		}
	}
	else {
		callback();
	}
}

PopupCreator.prototype.close = function(){
	var t = this;
	this.saveSetup();

	if(t.minimizedElement)
		t.minimizedElement.remove();

	this.element.fadeOut(100, function(){
		if(t.options.hideOnClose === true){
			t.isHidden = true;
		} else {
			t.element.remove();
			t.element = undefined;
			t.contentObjects = undefined;
		}

		if(typeof(t.options.onClose) === "function")
			t.options.onClose.call(t);
	});
	if(this.options.modal === true)
		$("body").find(".pcoverlay").fadeOut(100);
}

PopupCreator.prototype.saveSetup = function(){
	if(typeof(Storage)!=="undefined" && this.options.typeId !== undefined){
		if(this.cachedSetup === undefined)
			this.cachedSetup = {}

		var isMaximized = this.element.hasClass("pcpopupmaximized");
		if(isMaximized)
			this.cachedSetup.isMaximized = true;
		else
			this.cachedSetup = {
														width: this.element.width(),
														height: this.element.height(),
														x: this.element.position().left,
														y: this.element.position().top,
														isMaximized: isMaximized
													};

		var entireSetup = JSON.parse(localStorage.PopupCreatorCachedSetup);
		entireSetup[this.options.typeId] = this.cachedSetup;
		localStorage.PopupCreatorCachedSetup = JSON.stringify(entireSetup);
	}
}

PopupCreator.prototype.minimize = function(){
	if(!this.element.hasClass("pcpopupmaximized")){
		this.originalWidth = this.element.width();
		this.originalHeight = this.element.height();
	}

	this.addTaskIcon();
	this.element.addClass("pcpopupminimized");
	this.element.css("z-index", 0);
}

PopupCreator.prototype.addTaskIcon = function(){
	if(this.minimizedElement)
		return;

	var minTabs = $("#pcminimizedtabls");

	if(minTabs.length < 1){
		minTabs = $("div.tbctasks");
		this.keepMinimizedLink = true;
	}

	if(minTabs.length < 1){
		minTabs = $("<div id='pcminimizedtabls'></div>");
		$("body").append(minTabs);
	}

	var t = this;

	this.minimizedElement = $("<div></div>", {class: "tbctask"});

	if(this.options.icon !== undefined)
		this.minimizedElement.append($("<img/>", {src: this.options.icon}));

	this.minimizedElement.append($("<span/>", {text: this.options.title}));
	this.minimizedElement.click(function(e){
		if(e.which == 1){
			if(t.element.hasClass("pcpopupminimized")){
				t.restore();
			} else if(t.hasFocus()){
				t.minimize();
			} else {
				t.focus();
				t.element.addClass("pcfocused-animation");
				setTimeout(function(){
					t.element.removeClass("pcfocused-animation");
				}, 200);
			}
		} else if(e.which == 2){
			t.close();
		}
	});

	minTabs.append(this.minimizedElement);
}

PopupCreator.prototype.restore = function(){
	var ret = false;

	if(this.element.hasClass("pcpopupminimized")){
		this.element.removeClass("pcpopupminimized");
		this.focus();
		if(this.keepMinimizedLink !== true)
			this.minimizedElement.remove();
		ret = true;
	} else if(this.element.hasClass("pcpopupmaximized")){
		this.element.removeClass("pcpopupmaximized");

		this.restoreBtn.hide();
		this.maximizeBtn.show();

		if(!isNaN(this.originalWidth)){
			this.element.width(this.originalWidth);
			this.element.height(this.originalHeight);
		}
		ret = true;
	}

	if(ret)
		this.fixSizing();

	return ret;
}

PopupCreator.prototype.maximize = function(){
	this.originalWidth = this.element.width();
	this.originalHeight = this.element.height();

	this.restoreBtn.show();
	this.maximizeBtn.hide();

	this.element.height($(window).height() - $("div.tbcbar").height());
	this.element.addClass("pcpopupmaximized");
	this.fixSizing();
}

PopupCreator.prototype.hide = function(){
	this.element.hide();
	this.isHidden = true;
}

PopupCreator.prototype.isVisible = function(){
	return this.isHidden === true || !this.element.is(":visible")? false : true;
}

PopupCreator.prototype.print = function(cssStyles){
	var tab = this.element.find(".pccontent").clone(false, false);

	if(cssStyles){
		for(var i in cssStyles){
			tab.find(i).css(cssStyles[i]);
		}
	}

	var popupCreator = new PopupCreator();
	popupCreator.init({
							title: "Print table contents",
							contentIFrame: "",
							style: {width: "800px", height: "400px"},
							//maximize: true,
							onShow: function(){
								if(t.options && t.options.title)
									this.element.find("iframe").contents().find('body').append("<h3>" + t.options.title + "</h3>");
								this.element.find("iframe").contents().find('body').append(tab);
								var frame  = this.element.find("iframe")[0];
								var win = frame.contentWindow || frame
								win.print();

								this.element.find("iframe").contents().keydown(function(e) {
									if (e.keyCode == 27) { //ESC
										popupCreator.close();
										if(document.activeElement){
											// Restore focus back to document, by removing focus from active element
											document.activeElement.blur();
										}
									}
								});
							}
						});
	popupCreator.show();
}

if(window.isMobile === undefined){
	isMobile = function() {
		var check = false;
		(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true})(navigator.userAgent||navigator.vendor||window.opera);
		return check;
	}
}
