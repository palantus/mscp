"use strict"

class UI{
  init(){
    this.path = window.location.pathname;
    if(this.path.endsWith("/"))
      this.path = this.path.substring(0, this.path.length - 1);

    this.appName = this.path.substring(this.path.lastIndexOf("/")+1)
    this.basePath = this.path.substring(0, this.path.length - this.appName.length)
    this.actionHandlers = {};
    this.actions = {};
    this.ready = mscp.req(`${this.basePath}uidef`);
    this.ready.then((def) => {
      this.uiDef = def;
      this.app = this.uiDef.apps[this.appName];
      this.items = this.uiDef.items || {};
      window.document.title = this.app.title;
      $("#title").html(this.app.title)
      $("#hamburger").click(() => $("#menu").toggle())
      $("#floatingactionbar").click(() => $("#floatingactionbar").addClass("hidden"))
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

      item.fullName = (item.namespace ? item.namespace + "." : "") + item.name;
      this.actions[item.fullName] = {item: item, serve: serve, title: title}

      let functionDiv = $("<div></div>", {class: "menuitem menuitemfunction", html: title});
      functionDiv.data("def", this.actions[item.fullName])
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
    if(defaultIndex != null && !isNaN(defaultIndex) && defaultIndex >= 0 && $("#menu div.menuitemfunction").length >= defaultIndex)
      $("#menu div.menuitemfunction")[defaultIndex].click();

    $(document).keypress((e) => {
      if(e.which == 13) {
        this.runFunction();
      }
    });

    if(this.app.showMenu === false){
      $("#menu").hide();
      $("#hamburger").hide();
    }
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
    ui.showItem(data);
    $("#itemcontainer").show();
  }

  showItem(item){
    this.curItem = item.item.namespace + "." + item.item.name;
    if(this.actionHandlers[this.curItem] === undefined){
      this.actionHandlers[this.curItem] = new ActionHandler(item);
    }
    this.actionHandlers[this.curItem].show();
  }

  runFunction(){
    this.actionHandlers[this.curItem].run();
  }
}

var ui = new UI();
ui.init();
$(() => ui.run());
