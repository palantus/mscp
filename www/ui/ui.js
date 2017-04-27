"use strict"

class UI{
  init(){
    this.path = window.location.pathname;
    if(this.path.endsWith("/"))
      this.path = this.path.substring(0, this.path.length - 1);

    this.appName = this.path.substring(this.path.lastIndexOf("/")+1)
    this.basePath = this.path.substring(0, this.path.length - this.appName.length)
    this.ready = mscp.req(`${this.basePath}uidef`);
    this.ready.then((def) => {
      this.uiDef = def;
      this.app = this.uiDef.apps[this.appName];
      this.items = this.uiDef.items || {};
      window.document.title = this.app.title;
      $("#title").html(this.app.title)
      $("#hamburger").click(() => $("#menu").toggle())
      $("#function-call-execute").click(() => this.runFunction());
      if(!this.app) alert("invalid app")
    });
  }

  async run(){
    await this.ready
    await mscp.ready;

    let defaultIndex = this.app.defaultIndex !== undefined ? this.app.defaultIndex : 0;
    let curIdx = 0;

    let items = []
    if(!Array.isArray(this.app.items) && typeof this.app.items === "object"){
      for(let i in this.app.items){
        for(let iidx = 0; iidx < this.app.items[i].length; iidx++){
          this.app.items[i][iidx] = typeof this.app.items[i][iidx] === "string" ? {name: this.app.items[i][iidx]} : this.app.items[i][iidx]
          this.app.items[i][iidx].group = i
          items.push(this.app.items[i][iidx])
        }
      }
    } else {
      items = this.app.items;
    }

    for(let i of items){
      let appItem = typeof i === "object" ? i : {name: i};
      let item = this.items[appItem.name]
      if(item){
        item.name = appItem.name
        item.group = appItem.group || item.group
      } else {
        item = appItem
      }

      item.namespace = item.namespace || null;
      if(item.name.indexOf(".")>0)
        [item.namespace, item.name] = item.name.split(".");

      if(!item.group && item.namespace != null)
        item.group = item.namespace.replace(/([A-Z][a-z])/g, ' $1').replace(/^./, function(str){ return str.toUpperCase(); })

      let serve = mscp.def.serve.find((serv) => serv.namespace ? (serv.name == item.name && serv.namespace == item.namespace) : serv.name == item.name);
      if(!serve)
        continue;

      let title = item.title || serve.title || serve.name;

      let functionDiv = $("<div></div>", {class: "menuitem menuitemfunction", html: title});
      functionDiv.data("def", {item: item, serve: serve, title: title})
      functionDiv.click(this.onItemClick)

      if(item.group){
        let groupContainer = $(`#menuitems div.group[data-group="${item.group}"]`)
        if(groupContainer.length <= 0){
          groupContainer = $("<div></div>", {class: "group", "data-group" : item.group});

          let groupElement = $("<div></div>", {class: "menuitem menuitemgroup", html: item.group + "<span class='menuarrow'> ▾</span>"});
          groupElement.click(this.onGroupClick)
          groupElement.data("group", item.group)
          groupContainer.append(groupElement)
          $("#menuitems").append(groupContainer);
        }

        if(curIdx === defaultIndex){
          groupContainer.addClass("open")
        }

        functionDiv.html(`<span class="submenuindicator">-</span> ${functionDiv.html()}`)
        functionDiv.data("group", item.group)
        groupContainer.append(functionDiv);
      } else {
        $("#menuitems").append(functionDiv);
      }
      curIdx++;
    }
    if(defaultIndex && defaultIndex >= 0)
      $("#menu div.menuitemfunction")[defaultIndex].click();

    $(document).keypress((e) => {
      if(e.which == 13) {
        this.runFunction();
      }
    });
  }

  onGroupClick(){
    let group = $(this).data("group");
    $(`#menuitems div.group[data-group="${group}"]`).toggleClass("open")
    $(`#menuitems div.group[data-group="${group}"] div.menuitemgroup`).toggleClass("selected")
  }

  onItemClick(){
    let data = $(this).data("def");
    $(".menuitem").removeClass("selected")
    $(this).addClass("selected")
    ui.showItem(data.item, data.serve, data.title);
    $("#itemcontainer").show();
  }

  showItem(item, serve, title){
    this.curItem = {item: item, serve: serve, title: title};
    $("#itemtitle").html(title)

    $("#function-call-args").empty();
    $("#function-call-results").hide();
    $("#function-call-execute").show();

    if(serve.args === undefined || serve.args.length < 1){
      $("#function-args").hide();
      $("#function-call-args").empty();
    } else {
      $("#function-args tbody").empty();
      $("#function-args tbody").show();

      for(let a of serve.args){
        let elementStr = null;
        let defaultValue = (((item.args||{})[a.name])||{})["default"]
        switch(a.type){
          case "string":
          case "*":
            elementStr = `<input data-arg="${a.name}" value="${defaultValue||""}" type="text" placeholder=""/>`;
            break;
          case "integer":
          case "float":
            elementStr = `<input data-arg="${a.name}" value="${defaultValue||""}" type="number" placeholder=""/>`;
            break;
          case "boolean":
            elementStr = `<input data-arg="${a.name}" type="checkbox" ${defaultValue===true?"checked":""}/>`;
            break;
          case "object":
            defaultValue = (typeof defaultValue === "object" ? JSON.stringify(defaultValue, null, 2) : item.default) || "";
            elementStr = `<textarea data-arg="${a.name}" value="${defaultValue}" placeholder="JSON Object"/>`;
            break;
          case "array":
            defaultValue = (typeof defaultValue === "object" ? JSON.stringify(defaultValue, null, 2) : item.default) || "";
            elementStr = `<textarea data-arg=$"${a.name}" value="${defaultValue}" placeholder="JSON Array"/>`;
            break;
          default:
            alert(`Unsupported argument type: ${a.type}`);
        }

        if(elementStr != null){
          let title = ((item.args !== undefined && item.args[a.name] !== undefined) ? item.args[a.name].title : undefined) || a.title || a.name;
          let element = $(`<div class="function-call-arg-container"><span class="function-call-arg-name">${title}:</span>${elementStr}<span class="tooltiptext">${a.description}</span></div>`)
          $("#function-call-args").append(element)
          $("#function-call-args input:first").focus();
        }
      }
    }
  }

  runFunction(){
    let args = this.curItem.serve.args || []
    let data = []
    for(let a of args){
      let val = null;

      switch(a.type){
        case "string":
        case "*":
          val = $(`.function-call-arg-container [data-arg="${a.name}"]`).val()
          break;
        case "integer":
          val = parseInt($(`.function-call-arg-container [data-arg="${a.name}"]`).val())
          break;
        case "float":
          val = parseFloat($(`.function-call-arg-container [data-arg="${a.name}"]`).val())
          break;
        case "boolean":
          val = $(`.function-call-arg-container [data-arg="${a.name}"]`).is(":checked");
          break;
        case "object":
        case "array":
          try{
            let jsonStr = $(`.function-call-arg-container [data-arg="${a.name}"]`).val()
            val = jsonStr != "" ? JSON.parse(jsonStr) : null;
          } catch(err){
            alert("Invalid JSON in argument " + a.name)
            return;
          }
          break;
        default:
          alert(`Unsupported argument type: ${a.type}`);
      }
      data.push(val !== undefined ? val : null);
    }
    let obj = this.curItem.serve.namespace ? mscp[this.curItem.serve.namespace] : mscp
    obj[this.curItem.serve.name].apply(mscp, data).then((result) => {
      $("#function-call-results").empty();
      result = this.transformResults(result)
      parseAndAddResponse(result, $("#function-call-results"))
      $("#function-call-results").show();
    })
  }

  transformResults(result){
    if(!result && result !== false)
      return (this.curItem.item.result || {}).emptyText || "<empty response>"
    else if(Array.isArray(result) && result.length == 0)
      return (this.curItem.item.result || {}).emptyText || "<empty array>"
    else if(Object.keys(result).length === 0 && result.constructor === Object)
      return (this.curItem.item.result || {}).emptyText || "<empty object>"

    if(this.curItem.item.result === undefined)
      return result;

    if(Array.isArray(result)){
      let columns = this.curItem.item.result.columns || {}
      for(let c in columns){
        for(let row of result){
          row[columns[c]] = row[c];
          delete row[c];
        }
      }
    } else if(typeof result === "object"){
      let properties = this.curItem.item.result.properties || {}
      for(let c in properties){
        result[properties[c]] = result[c];
        delete result[c];
      }
    }
    return result;
  }
}

var ui = new UI();
ui.init();
$(() => ui.run());
