/*
TODO:
- Hvis man skjuler header, kan popup ikke vises!


Sample options:
elementId: "MainTable",
clickable: true,
linesPerPage: 20,
columns: [
			{title: "Nummer", dataKey: "AssignmentNum"},
			{title: "Prioritet", dataKey: "Priority", align: "center"}
		 ],
onClick: function(row, idx){...},
hideFooter: true,
hideHeader: true,
showRecordsPerPageSelector: true,
showFieldsSelector: true,
allowDrag: false,
confirmDelete: true,
sortable: false,
initialData: [] - The initially shown data. Can be used to preload data. When reloading the datasource etc. are used.
createRecord: {
				fields: [
							{name: "test", title: "Indtast værdi"},
							{name: "test2", title: "Indtast værdi", type: "textarea", style: {width: "300px", height: "150px"}},
							{name: "test3", title: "Vælg værdi", type: "select", values: {"type1" : "Værdi 1", "type2" : "Værdi 2"}}
						],
				validate: function(record){return record.test !== "";},
				onCreate: function(record){tableCreator.data.push(record);tableCreator.setData(tableCreator.data);}
				onBeforeCreate: function(){pc, popup}
				onValidationEror: function(pc, popup, record){}
			}
deleteRecord: {
	onDelete: function(record){alert("Deleting: " + record.test + " (" + record.id + ")");}
}
editRecord: {
	fields: [
				{name: "test", title: "Indtast værdi"},
				{name: "test2", title: "Indtast værdi", type: "textarea", style: {width: "300px", height: "150px"}, onChange: function(){}},
				{name: "test3", title: "Vælg værdi", type: "select", values: [{id: "type1", label: "Værdi 1"}, {id: "type2", label: "Værdi 2"}]} //NB: Can use Label/label and id/Id
			],
	validate: function(oldRecord, newRecord){return newRecord.test !== "";},
	onEdit: function(oldRecord, newRecord){alert(newRecord.id + ": " + oldRecord.test + " ændret til " + newRecord.test);}
},
dataSource: function(cb){cb(data);}
recordRightClickMenu:
	Et object med properties for at lave en RightClickMenu, som så tilføjes til hver række i tabellen.
	Rækken sendes med til onClick som arg 2 (arg 1 er den action man har klikket på).
	Arg 3 er et callback som vil kalde reloadData (man behøver ikke at kalde den).
	Data fra en den row man højreklikker på, kan tilgås via this.options.tcRecord

orderByColumn: er en kolonne index som der skal sorteres efter (0, 1, 2, 3, hvis det er et array af fields).
orderASC: er en true/false for hvilken retning der skal sorteres


Noter:
- columns kan udelades, hvilket betyder at kolonner automatisk bliver oprettet ud fra data.
- hvis man kalder reloadData med et argument, sendes dette med som arg 2 til dataSource funktionen (ment til søgning).
- der er lavet en helperfunction filterDataFromQuery som tager 2 argumenter (data og filter) og returnerer data filtreret efter det filter (søger på alle keys)
- On a popup, you can access a tablecreator on the same popup like: popupCreator.contentObjects[TCINDEX].reloadData(query);
- When editing/creating record, you can set a default value with .value
- under createRecord.fields kan man angive onChange som er en funktion der får parametre (newValue, inputElement, popupElement)
*/

function TableCreator(language){
	this.type = "TableCreator";
	this.options = {};
	this.data = [];
	this.page = 0;
	this.linesPerPage = Number.MAX_VALUE;
	this.lastReloadCalled = 0;
	this.lastQuery = undefined;
	this.cachedSetup = {};
	this.language = language ? language : "en";
	this.fieldSelectMouseOutTimer = null;

	this.translations = {
							da: {
								save: "Gem",
								close: "Luk",
								cancel: "Annuller",
								create: "Opret",
								all: "Alle",
								choosefields: "Vælg felter",
								loading: "Henter",
								editrecord: "Rediger post",
								deleterow: "Slet post",
								newrecord: "Ny post",
								viewrecord: "Vis post",
								noresults: "Ingen resultater",
								invaliddata: "Ugyldig data",
								deleteconfirm: "Er du sikker på at du vil slette denne post?",
								show: "Vis",
								"new": "Ny"
							},
							en: {
								save: "Save",
								close: "Close",
								cancel: "Cancel",
								create: "Create",
								all: "All",
								choosefields: "Choose fields",
								loading: "Loading",
								editrecord: "Edit record",
								deleterow: "Delete record",
								newrecord: "New record",
								viewrecord: "View record",
								noresults: "No results",
								invaliddata: "Invalid data",
								deleteconfirm: "Are you sure that you want to delete this record?",
								show: "Show",
								"new": "New"
							}
						}
}

TableCreator.prototype.init = function(_options){
	this.options = _options;

	if(_options !== undefined && _options.language !== undefined)
		this.language = _options.language;

	if(typeof(Storage)!=="undefined" && this.options.typeId !== undefined){
		if(localStorage.TableCreatorCachedSetup === undefined)
			localStorage.TableCreatorCachedSetup = JSON.stringify({});

		this.cachedSetup = JSON.parse(localStorage.TableCreatorCachedSetup)[this.options.typeId];
		if(this.cachedSetup === undefined)
			this.cachedSetup = {};
	}


	return this;
}

TableCreator.prototype.setData = function(_data){
	this.data = _data;
	this.page = 0;
	this.isLoading = false;
	if(this.loadingDiv !== undefined)
		this.loadingDiv.fadeOut("fast");
	this.refreshData();
}

TableCreator.prototype.rowClicked = function(row){
}

TableCreator.prototype.setLinesPerPage = function(row){
	var tmpNum = $("#" + this.options.elementId + " div.tcheader select").val();
	if(!isNaN(tmpNum))
		this.linesPerPage = parseInt(tmpNum);
	else if(tmpNum == "all")
		this.linesPerPage = Number.MAX_VALUE;
	else if(this.cachedSetup.linesPerPage)
		this.linesPerPage = this.cachedSetup.linesPerPage;
	else if(this.options.linesPerPage)
		this.linesPerPage = this.options.linesPerPage;
	else
		this.linesPerPage = Number.MAX_VALUE;
}

TableCreator.prototype.draw = function(callback){
	this.setLinesPerPage();

	if(this.options.elementId === undefined)
		return;
	if(typeof(this.data) !== "object")
		return;

	var ele = $("#" + this.options.elementId);
	ele.empty();

	if(this.options.style !== undefined)
		ele.css(this.options.style);

	var tab = $("<table class='tctable'><thead></thead><tbody></tbody></table>");

	var startIdx = Math.max(Math.min(this.page * this.linesPerPage, this.data.length), 0);
	var endIdx = Math.min(startIdx + this.linesPerPage, this.data.length) - 1;

	var tableDiv = $("<div class='tcdiv'></div>");

	var t = this;
	if(this.options.hideHeader !== true){
		var header = $("<div class='tcheader'></div>");


		var topLeftHeader = $("<span class='tcleft'></span>");

		if(t.options.showRecordsPerPageSelector === true){
			topLeftHeader.append(t.label("show") + " ");
			var selectionValues = "<option value='10'>10</option><option value='20'>20</option><option value='50'>50</option><option value='100'>100</option><option value='all'>" + this.label("all") + "</option>"
			var selector = $("<select>" + selectionValues + "</select>");
			selector.val(this.linesPerPage < Number.MAX_VALUE ? this.linesPerPage : 'all');
			selector.change(function(){t.refreshData();});
			topLeftHeader.append(selector);
			//topLeftHeader.append(" linjer per side");
		}

		header.append(topLeftHeader);

		var topRightHeader = $("<span class='tcright'></span>");

		if(this.options.createRecord !== undefined){
			var newRecordButton = $("<button></button>", {html: this.label("new")});
			newRecordButton.click(function(){
				t.showRecordPopup(function(record){
					t.options.createRecord.onCreate.call(t, record, function(){
						t.reloadData();
					});
				});
			});
			topRightHeader.append(newRecordButton);
		}

		if(t.options.showPrint !== false && !window.isMobile()){
			var printButton = $("<button title='Print'><img style='width:15px;height:12px' src='/mscp/img/print.png'></img></button>");
			printButton.click(function(){
				/*
				var myWindow = window.open("", "", "width=700, height=400");
				myWindow.document.title = "Print table contents";
				var tab = $("#" + t.options.elementId).find("table.tctable").clone();
				tab.css({"border-spacing": "0px"});
				tab.find("td.tceditcell").remove();
				tab.find("td.tcdeletecell").remove();
				tab.find("td.tceditheader").remove();
				tab.find("td.tcdeleteheader").remove();
				tab.find("th").css({"border-bottom": "1px solid black", "text-align": "left", "padding-right": "10px"});
				tab.find("td").css({"border-bottom": "1px solid gray", "padding-right": "10px"});
				tab.find("tr").attr("draggable", "false");
				$(myWindow.document.body).append(tab);
				*/
				var tab = $("#" + t.options.elementId).find("table.tctable").clone(false, false);
				tab.css({"border-spacing": "0px"});
				tab.find("td.tceditcell").remove();
				tab.find("td.tcdeletecell").remove();
				tab.find("td.tceditheader").remove();
				tab.find("td.tcdeleteheader").remove();
				tab.find("th").css({"border-bottom": "1px solid black", "text-align": "left", "padding-right": "10px"});
				tab.find("td").css({"border-bottom": "1px solid gray", "padding-right": "10px"});

				var popupCreator = new PopupCreator();
				popupCreator.init({
										title: "Print table contents",
										contentIFrame: "",
										style: {width: "800px", height: "400px"},
										//maximize: true,
										onShow: function(){
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
			});
			topRightHeader.append(printButton);
		}

		if(this.options.dataSource !== undefined){
			var refreshButton = $("<button title='Refresh'><img style='width:15px;height:12px' src='/mscp/img/refresh.png'></img></button>");
			refreshButton.click(function(){t.reloadData();});
			topRightHeader.append(refreshButton);
		}

		if(t.options.showFieldsSelector === true){
			var fieldsButton = $("<button></button>", {html: this.label("choosefields")});
			fieldsButton.click(function(){t.toggleFieldsPopup();});
			topRightHeader.append(fieldsButton);
		}

		var popup = $("<div class='tcfieldspopup tcpopup'><table></table></div>");
		topRightHeader.append(popup);

		var newRecordPopup = $("<div class='tcrecordpopup tcpopup'></div>");
		topRightHeader.append(newRecordPopup);

		header.append(topRightHeader);

		tableDiv.append(header);
	}

	tableDiv.append(tab);

	if(this.options.hideFooter !== true){
		var footer = $("<div class='tcfooter'></div>");
		var lineCount = $("<span class='tcleft tclinecount'>" + (this.data.length>0?startIdx+1:0) + " - " + (this.data.length>0?Math.max(endIdx, 0)+1:0) + " ´(" + this.data.length + " total)</span>");
		var paging = $("<span class='tcright'></span>");
		var nextPage = $("<button class='nextbutton'>»</button>");
		nextPage.click(function(){t.nextPage();});
		var prevPage = $("<button class='prevbutton'>«</button>");
		prevPage.click(function(){t.prevPage();});

		paging.append(prevPage);
		paging.append(nextPage);
		footer.append(lineCount);
		footer.append(paging);
		tableDiv.append(footer);
	}

	ele.append(tableDiv);

	this.loadingDiv = $("<div/>", {class: "tcloading", html: this.label("loading") + "..."});
	ele.append(this.loadingDiv);

	t.reloadData(undefined, callback);
}

TableCreator.prototype.refreshData = function(_startIdx, _endIdx){
	var t = this;
	this.setLinesPerPage();
	var tabBody = $("#" + this.options.elementId + " table.tctable tbody");
	var tabHead = $("#" + this.options.elementId + " table.tctable thead");
	tabBody.empty();
	tabHead.empty();
	var row;
	var field;

	// Create headers if they are not defined
	if(this.options.columns === undefined || this.options.autoCreateColumns == true){
		var firstRecord = $.isArray(this.data) ? this.data[0] : {};
		this.options.columns = [];
		for(key in firstRecord)
			this.options.columns.push({title: key, dataKey: key});

		this.options.autoCreateColumns = true;
	}

	// Show table header
	if($.isArray(this.options.columns)){
		for(col in this.options.columns){
			if(typeof(this.options.columns[col]) == "object" && this.options.columns[col].visible === false)
				continue;

			var head = $("<th>" + (typeof(this.options.columns[col]) === "string" ? this.options.columns[col] : this.options.columns[col].title) + "</th>");
			head.data("col", col);
			if(this.options.columns[col].width !== undefined)
				head.css("width", this.options.columns[col].width);

      if(this.options.sortable !== false){
  			head.click(function(){
  				var newOrderByCol = $(this).data("col");
  				if(newOrderByCol != t.options.orderByColumn){
  					t.options.orderByColumn = newOrderByCol;
  					t.options.orderASC = true;
  				} else {
  					t.options.orderASC = t.options.orderASC === true ? false : true;
  				}
  				t.refreshData();
  			});
      }

			if(typeof(this.options.columns[col].align) == "string"){
				head.css("text-align", this.options.columns[col].align);
			}

			tabHead.append(head);
		}

		if(typeof(this.options.editRecord) === "object")
			tabHead.append("<th class='tceditheader'></th>");
		if(typeof(this.options.deleteRecord) === "object")
			tabHead.append("<th class='tcdeleteheader'></th>");
	}

	if(this.options.columns === undefined)
		return;


	// Need to move onClick to another variable, to override the functionality of onClick here...
	if(this.options.recordRightClickMenu !== undefined){
		for(a in this.options.recordRightClickMenu.actions){
			this.options.recordRightClickMenu.actions[a].onClickOverride = function(action, ele){
				var idx = $(ele).data("ui-idx");
				var data = t.data[idx];
				if(typeof(action.onClick) === "function")
					action.onClick.call(t, action, data, function(){
						t.reloadData();
					});
			}
		}
	}


	if(!isNaN(this.options.orderByColumn) && $.isArray(this.data) && typeof(t.options.columns[t.options.orderByColumn]) === "object")
		this.data.sort(function(a, b){
			var dataKey = t.options.columns[t.options.orderByColumn].dataKey;
			var val1 = a[dataKey] || "";
			var val2 = b[dataKey] || "";

			if(typeof(val1) === "string")
				val1 = val1.toLowerCase();
			if(typeof(val2) === "string")
				val2 = val2.toLowerCase();

			return val1 < val2 ? (t.options.orderASC ? -1 : 1) : (t.options.orderASC ? 1 : -1);
		});



	/*
	var startIdx = _startIdx !== undefined ? _startIdx : 0;
	var endIdx = _endIdx !== undefined ? _endIdx : Math.min(startIdx + this.linesPerPage, this.data.length) - 1;
	*/
	var startIdx = Math.max(Math.min(this.page * this.linesPerPage, this.data.length), 0);
	var endIdx = Math.min(startIdx + this.linesPerPage, this.data.length) - 1;

	for(var r = startIdx; r <= endIdx && !this.isLoading; r++){
		row = $("<tr></tr>");
		row.data("ui-idx", r);
		row.data("tcrowdata", t.data[r]);
		if(t.options.allowDrag !== false){
			row.attr("draggable", "true");
			row[0].addEventListener("dragstart", function(ev){
				ev.dataTransfer.setData("record", JSON.stringify($(this).data("tcrowdata")));
				ev.dataTransfer.setData("tcoptions", JSON.stringify(t.options));
			});
		}

		if(this.options.clickable === true)
			row.addClass("clickable");

		if(this.options.recordRightClickMenu !== undefined){
			new RightClickMenu().init(jQuery.extend(true, {element: row, tcRecord: this.data[r]}, this.options.recordRightClickMenu)).attach();
		}

		for(var tCol = 0; tCol < this.options.columns.length; tCol++){
			if(typeof(this.options.columns[tCol]) == "object" && this.options.columns[tCol].visible === false)
				continue;

			var td = $("<td></td>");
      let val = this.data[r][this.options.columns[tCol].dataKey]
      if(typeof val === "boolean")
        td.append(val ? "true" : "false")
      else
        td.append(val);

			if(this.options.clickable === true){
				//td.addClass("clickable");
				td.data("ui-idx", r);
				td.click(function(e){
					var idx = $(this).data("ui-idx");

					t.recordClicked(t.data[idx], idx)
				});
			}

			if(this.options.hideFooter && r == endIdx){
				if(tCol == 0)
					td.css("border-bottom-left-radius",  "5px");
				if(tCol == this.options.columns.length - 1)
					td.css("border-bottom-right-radius",  "5px");
			}

			if(typeof(this.options.columns[tCol].align) == "string"){
				td.css("text-align", this.options.columns[tCol].align);
			}

			row.append(td);
		}

		if(typeof(this.options.editRecord) === "object"){
			var cell = $("<td class='tceditcell'><img src='/mscp/img/edit.ico' title='" + this.label("editrecord") + "'></img></td>");
			cell.data("tcdatarecord", this.data[r]);
			var t = this;
			cell.click(function(){t.editRecord($(this).data("tcdatarecord"));});
			row.append(cell);
		}
		if(typeof(this.options.deleteRecord) === "object"){
			var cell = $("<td class='tcdeletecell'><img src='/mscp/img/delete.png' title='" + this.label("deleterow") + "'></img></td>");
			cell.data("tcdatarecord", this.data[r]);
			var t = this;
			cell.click(function(){t.deleteRecord($(this).data("tcdatarecord"));});
			row.append(cell);
		}

		tabBody.append(row);
	}

	if(this.data.length == 0 && !this.isLoading)
		tabBody.append("<tr><td style='text-align: center' colspan='100'>" + this.label("noresults") + "</td></tr>");
	else if(this.isLoading)
		tabBody.append("<tr><td style='text-align: center' colspan='100'>" + this.label("loading") + "...</td></tr>");

	$("#" + this.options.elementId + " span.tclinecount").html((this.data.length>0?startIdx+1:0) + " - " + (this.data.length>0?Math.max(endIdx, 0)+1:0) + " (" + this.data.length + " total)");

	$("#" + this.options.elementId + " button.prevbutton").toggle(this.prevPage(true));
	$("#" + this.options.elementId + " button.nextbutton").toggle(this.nextPage(true));

	this.saveSetup();

	if(this.popupCreator !== undefined)
		this.popupCreator.fixSizing();
}

TableCreator.prototype.editRecord = function(oldRecord){
	var t = this;
	if(typeof(this.options.editRecord.onEdit) === "function"){
		this.showRecordPopup(function(newRecord){
			//Add any hidden values to the oldRecord variable:
			for(key in oldRecord)
				if(newRecord[key] === undefined)
					newRecord[key] = oldRecord[key];

			//Callback
			t.options.editRecord.onEdit.call(t, oldRecord, newRecord, function(){
				t.reloadData();
			});
		}, oldRecord);
	}
}

TableCreator.prototype.deleteRecord = function(record){
	if(typeof(this.options.deleteRecord.onDelete) === "function" && (this.options.confirmDelete === false || window.confirm(this.label("deleteconfirm")))){
		var t = this;
		this.options.deleteRecord.onDelete.call(this, record, function(){
			t.reloadData();
		});
	}
}

TableCreator.prototype.recordClicked = function(record, idx){
	if(typeof(this.options.onClick) === "function")
		this.options.onClick.call(this, record, idx);

	if(typeof(this.options.showRecord) === "object"){
		this.showRecordPopup(function(){}, record, true);
		t = this;
		if(typeof(this.options.showRecord.onShow) === "function"){
			this.options.showRecord.onShow(record, function(){
				t.reloadData();
			});
		}
	}
}

TableCreator.prototype.nextPage = function(fake){
	if((this.page+1) * this.linesPerPage < this.data.length){
		if(!fake){
			this.page++;
			this.refreshData();
		}
		return true;
	}
	return false;
}

TableCreator.prototype.prevPage = function(fake){
	if(this.page > 0){
		if(!fake){
			this.page--;
			this.refreshData();
		}
		return true;
	}
	return false;
}

TableCreator.prototype.toggleFieldsPopup = function(){
	var popup = $("#" + this.options.elementId + " div.tcfieldspopup");
	if(!popup.is(":visible")){
		$("#" + this.options.elementId + " div.tcpopup").hide();

		var list = popup.find("table");
		list.empty();

		var t = this;
		if(typeof(this.options.columns) == "object"){
			for(col in this.options.columns){
				var item = $("<tr class='" + (this.options.columns[col].visible === false ? "disabled" : "enabled") + "'><td></td><td>" + (typeof(this.options.columns[col]) === "string" ? this.options.columns[col] : this.options.columns[col].title) + "</td></tr>");
				item.data("column", col);
				item.click(function(){
					if($(this).is(".enabled")){
						$(this).removeClass("enabled").addClass("disabled");
						t.options.columns[$(this).data("column")].visible = false;
					} else {
						$(this).removeClass("disabled").addClass("enabled");
						t.options.columns[$(this).data("column")].visible = true;
					}
					t.refreshData();
				});

				list.append(item);
			}
		}
	}

	popup.toggle();

	var t = this;
	var fieldSelectMouseOutTimer = setTimeout(function(){
		if(popup != null)
			popup.fadeOut("fast");
	}, 1000);

	popup.mouseleave(function(){
		fieldSelectMouseOutTimer = setTimeout(function(){
			if(popup != null)
				popup.hide();
		}, 300);
	});

	popup.mouseenter(function(){
		clearTimeout(fieldSelectMouseOutTimer);
	});
}

TableCreator.prototype.showRecordPopup = function(callback, baseRecord, viewOnly){
	if(this.options.createRecord !== undefined && typeof this.options.createRecord.overrideCreate === "function"){
		this.options.createRecord.overrideCreate.call(this, callback, baseRecord, viewOnly);
		return;
	}

	if(typeof PopupCreator !== "function")
		return;

	var pc = new PopupCreator();
	var pcProp = {};

	var popup = $("<div/>", {class: "tceditrecord"});

	var t = this;

	var options = {};
	if(baseRecord === undefined){
		pcProp.title = this.label("newrecord");
		options = this.options.createRecord;
	} else if(viewOnly === true){
		pcProp.title = this.label("viewrecord");
		options = this.options.showRecord;
	} else {
		pcProp.title = this.label("editrecord");
		options = this.options.editRecord;
	}

	if(options.title !== undefined)
		pcProp.title = options.title;

	if(!$.isArray(options.fields))
		return;

	var tab = $("<table></table>");

	var firstInput = null;
	for(col in options.fields){
		var row = $("<tr></tr>");
		var item = $("<td>" + (typeof(options.fields[col]) === "string" ? options.fields[col] : options.fields[col].title) + "</td>");
		row.append(item);
		var inp = undefined;
		if(options.fields[col].type == "textarea"){
			inp = $("<textarea></textarea>");
      if(options.fields[col].placeholder !== undefined)
				inp.attr("placeholder", options.fields[col].placeholder);
		} else if(options.fields[col].type == "select"){
			var dd = $("<select></select>");
			this.appendControlValues(dd, options.fields[col].values, typeof(baseRecord) === "object" ? baseRecord[options.fields[col].name] : options.fields[col].value);
			/*
			if(typeof(options.fields[col].values) === "function"){
				this.appendControlValues(dd, options.fields[col].values
			} else {
				for(var i = 0; i < options.fields[col].values.length; i++){
					var id = options.fields[col].values[i].Id !== undefined ? options.fields[col].values[i].Id : options.fields[col].values[i].id;
					var label = options.fields[col].values[i].Label !== undefined ? options.fields[col].values[i].Label : options.fields[col].values[i].label;
					dd.append("<option value='" + id + "'>" + label + "</option>");
				}
			}*/
			inp = dd;
			if(viewOnly)
				inp.prop("disabled",true);
		} else if(options.fields[col].type == "checkbox"){
			inp = $("<input type='checkbox'></input>");
			inp.attr("checked", typeof(baseRecord) !== "object" ? false : baseRecord[options.fields[col].name] ? true : false);
		} else {
			inp = $("<input type='text'></input>");
			if(options.fields[col].placeholder !== undefined)
				inp.attr("placeholder", options.fields[col].placeholder);
		}
		if(typeof(baseRecord) === "object")
			inp.val(baseRecord[options.fields[col].name]);
		else if(typeof(options.fields[col].value) === "function")
			inp.val(options.fields[col].value());
		else if(options.fields[col].value !== undefined)
			inp.val(options.fields[col].value);

    if(typeof options.fields[col].onChange === "function"){
      inp.data("fieldscoloptions", options.fields[col])
      inp.change(function(){
        let functionToCall = $(this).data("fieldscoloptions").onChange
        functionToCall.call(t, $(this).val(), $(this), popup)
      })
    }

    if(options.fields[col].visible === false){
      row.hide();
    }

    inp.attr("name", options.fields[col].name);

		if(viewOnly)
			inp.prop("readonly",true);

		if(options.fields[col].style !== undefined)
			inp.css(options.fields[col].style);

		var td = $("<td></td>");
		td.append(inp);
		row.append(td);
		tab.append(row);

		if(firstInput == null)
			firstInput = inp;
	}

	var row = $("<tr class='internal'></tr>");
	row.append("<td></td>");
	var cell = $("<td></td>");

	if(viewOnly !== true){
		var btnCreate = $("<button class='tcbutton'>" + (baseRecord !== undefined ? this.label("save") : this.label("create")) + "</button>");
		btnCreate.click(function(){
			if(typeof(options.onBeforeCreate) === "function")
				options.onBeforeCreate.call(pc, popup);

			if(typeof(callback) === "function"){
				var record = {};
				pc.element.find("table tr").each(function(idx){
					var val = undefined;

					if(!$(this).is(".internal")){
						if($(this).find("input").length > 0){
							if(options.fields[idx].type == "checkbox")
								val = $(this).find("input").is(":checked");
							else
								val = $(this).find("input").val();
						} else if($(this).find("textarea").length > 0){
							val = $(this).find("textarea").val();
						} else if($(this).find("select").length > 0){
							val = $(this).find("select").val();
						}
					}
					if(val !== undefined){
						if(baseRecord !== undefined)
							record[t.options.editRecord.fields[idx].name] = val;
						else
							record[t.options.createRecord.fields[idx].name] = val;
					}
				});
				var valid = true;popup
				if(typeof(options.validate) === "function"){
					if(baseRecord !== undefined)
						valid = options.validate(baseRecord, record);
					else
						valid = options.validate(record);
				}

				if(valid === true){
					callback(record);
					pc.close();
				} else if(typeof(valid) === "string"){
					/*$("#" + t.options.elementId + " td.tcnewrecorderror").html(valid);*/
					pc.element.find(".tcnewrecorderror").html(valid);

					if(typeof(options.onValidationEror) === "function")
						options.onValidationEror.call(pc, popup, record);
				} else {
					$("#" + t.options.elementId + " td.tcnewrecorderror").html(t.label("invaliddata"));

					if(typeof(options.onValidationEror) === "function")
						options.onValidationEror.call(pc, popup, record);
				}
			}
		});
		cell.append(btnCreate);
	}

	var btnCancel = $(viewOnly === true ? "<button class='tcbutton'>" + t.label("close") + "</button>" : "<button class='tcbutton'>" + t.label("cancel") + "</button>");
	btnCancel.click(function(){pc.close();});


	cell.append(btnCancel);
	cell.append($("<span/>", {class: "tcnewrecorderror"}));
	row.append(cell);
	tab.append(row);
	//tab.append("<tr class='internal'><td colspan='2' class='tcnewrecorderror'></td></tr>");
	popup.append(tab);

	popup.find("input,select").keypress(function(e){
		if(e.which == 13)
			popup.find("button:first").click();
	});

	pcProp.content = popup;
	pc.init(pcProp);

	pc.show(function(){
		if(typeof(options.onShow) === "function")
			options.onShow.call(pc, popup);

		if(firstInput != null)
			firstInput.focus();

		//Set left column width to fixed to avoid it resizing with the dialog:
		var firstTd = this.element.find(".tceditrecord tr td:first-child");
		firstTd.width(firstTd.width());
	});
}

TableCreator.prototype.appendControlValues = function(parentElement, values, defaultValue){
	if(typeof(values) === "function"){
		values.call(this, function(values){
			for(var i = 0; i < values.length; i++){
				if(typeof(values[i]) === "object"){
					var id = values[i].Id !== undefined ? values[i].Id : values[i].id;
					var label = values[i].Label !== undefined ? values[i].Label
									: values[i].label !== undefined ? values[i].label
									: values[i].title !== undefined ? values[i].title
									: values[i].Title;
					parentElement.append("<option value='" + id + "'>" + label + "</option>");
				} else {
					parentElement.append("<option value='" + i + "'>" + values[i] + "</option>");
				}
			}

			if(typeof(defaultValue) === "function")
				parentElement.val(defaultValue());
			else if(defaultValue !== undefined)
				parentElement.val(defaultValue);
		});
	} else {
		for(var i = 0; i < values.length; i++){
			if(typeof(values[i]) === "object"){
				var id = values[i].Id !== undefined ? values[i].Id : values[i].id;
				var label = values[i].Label !== undefined ? values[i].Label : values[i].label;
				parentElement.append("<option value='" + id + "'>" + label + "</option>");
			} else {
				parentElement.append("<option value='" + values[i] + "'>" + values[i] + "</option>");
			}
		}

		if(typeof(defaultValue) === "function")
			parentElement.val(defaultValue());
		else if(defaultValue !== undefined)
			parentElement.val(defaultValue);
	}
}

TableCreator.prototype.reloadData = function(query, callback){
	var t = this;
	var thisReloadTime = this.lastReloadCalled = new Date().getTime();

	if(this.options.initialData !== undefined){
		t.setData(this.options.initialData);
		this.options.initialData = undefined;
		if(typeof(callback) === "function")
			callback();
	} else if(typeof(this.options.dataSource) === "function"){
		if(query === undefined)
			query = this.lastQuery
		this.lastQuery = query;

		this.startLoading();
		this.options.dataSource.call(this, function(data){
			if(thisReloadTime == t.lastReloadCalled){
				t.setData(data);
				if(typeof(callback) === "function")
					callback();
			}
		}, query);
	} else if($.isArray(this.options.data)){
		t.setData(this.options.data);
		if(typeof(callback) === "function")
			callback();
	} else {
		this.refreshData();
		if(typeof(callback) === "function")
			callback();
	}
}

TableCreator.prototype.startLoading = function(){
	var tc = $("#" + this.options.elementId);
	this.isLoading = true;
	if(tc !== undefined && this.loadingDiv !== undefined){
		var pos = Math.max(tc.height() / 2, tc.height() - 200);
		this.loadingDiv.css("top", - pos + "px");
		var t = this;
		setTimeout(function(){
			if(t.isLoading)
				t.loadingDiv.fadeIn("fast");
		}, 200);
	}
}

TableCreator.prototype.filterDataFromQuery = function(data, _filter){
	var filter = _filter;
	if(filter !== undefined){
		filter = filter.toLowerCase()
		filter = filter.split(" ");
	}

	var filterFunction = function(row){
		var foundMatch = false;
		for(var i in filter){
			foundMatch = false;
			for(var key in row){
				if(typeof(row[key]) === "string"){
					if(row[key].toLowerCase().indexOf(filter[i]) >= 0)
						foundMatch = true;
				}
			}
			if(!foundMatch)
				return false;
		}
		return foundMatch;
	}

	if(filter)
		return data.filter(filterFunction);
	else
		return data;
}

TableCreator.prototype.saveSetup = function(){
	if(typeof(Storage)!=="undefined" && this.options.typeId !== undefined){
		if(this.cachedSetup === undefined)
			this.cachedSetup = {}

		this.cachedSetup = 	{
								linesPerPage: this.linesPerPage
							};

		var entireSetup = JSON.parse(localStorage.TableCreatorCachedSetup);
		entireSetup[this.options.typeId] = this.cachedSetup;
		localStorage.TableCreatorCachedSetup = JSON.stringify(entireSetup);
	}
}

TableCreator.prototype.label = function(text){
	return this.translations[this.language][text];
}

if(window.isMobile === undefined){
	isMobile = function() {
		var check = false;
		(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true})(navigator.userAgent||navigator.vendor||window.opera);
		return check;
	}
}
