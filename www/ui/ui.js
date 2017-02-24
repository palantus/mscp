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
      this.app = this.uiDef.apps.find((a) => a.name == this.appName);
      this.items = this.uiDef.items || [];
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

    for(let i of this.app.items){
      let name = i;
      let namespace = null;

      if(i.indexOf(".")>0)
        [namespace, name] = i.split(".");

      let item = this.items.find((s) => s.name == i) || {name: i};
      [item.name, item.namespace] = [name, namespace];
      let serve = mscp.def.serve.find((serv) => serv.namespace ? (serv.name == name && serv.namespace == namespace) : serv.name == i);
      if(!serve)
        continue;

      let title = item.title || serve.title || serve.name;

      let functionDiv = $("<div></div>", {class: "menuitem menuitemfunction", html: title});
      functionDiv.data("def", {item: item, serve: serve, title: title})
      functionDiv.click(this.onItemClick)

      if(serve.namespace){
        let namespaceTitle = serve.namespace.replace(/([A-Z][a-z])/g, ' $1').replace(/^./, function(str){ return str.toUpperCase(); })
        item.namespace = serve.namespace;
        let namespaceContainer = $(`#menuitems div.namespace[data-namespace="${item.namespace}"]`)
        if(namespaceContainer.length <= 0){
          namespaceContainer = $("<div></div>", {class: "namespace", "data-namespace" : item.namespace});

          let namespaceElement = $("<div></div>", {class: "menuitem menuitemnamespace", html: namespaceTitle + "<span class='menuarrow'> ▾</span>"});
          namespaceElement.click(this.onNamespaceClick)
          namespaceElement.data("namespace", item.namespace)
          namespaceContainer.append(namespaceElement)
          $("#menuitems").append(namespaceContainer);
        }

        if(curIdx === defaultIndex){
          namespaceContainer.addClass("open")
        }

        functionDiv.data("namespace", item.namespace)
        namespaceContainer.append(functionDiv);
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

  onNamespaceClick(){
    let namespace = $(this).data("namespace");
    console.log(`#menuitems div.namespace[data-namespace="${namespace}"]`)
    $(`#menuitems div.namespace[data-namespace="${namespace}"]`).toggleClass("open")
    $(`#menuitems div.namespace[data-namespace="${namespace}"] div.menuitemnamespace`).toggleClass("selected")
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
        switch(a.type){
          case "string":
          case "*":
            elementStr = `<input data-arg=${a.name} type="text" placeholder=""/>`;
            break;
          case "integer":
          case "float":
            elementStr = `<input data-arg=${a.name} type="number" placeholder=""/>`;
            break;
          case "boolean":
            elementStr = `<input data-arg=${a.name} type="checkbox"/>`;
            break;
          case "object":
            elementStr = `<textarea data-arg=${a.name} placeholder="JSON Object"/>`;
            break;
          case "array":
            elementStr = `<textarea data-arg=${a.name} placeholder="JSON Array"/>`;
            break;
          default:
            alert(`Unsupported argument type: ${a.type}`);
        }

        if(elementStr != null){
          let title = a.title || a.name;
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
            val = JSON.parse($(`.function-call-arg-container [data-arg="${a.name}"]`).val());
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
    let obj = this.curItem.item.namespace ? mscp[this.curItem.item.namespace] : mscp
    obj[this.curItem.item.name].apply(mscp, data).then((result) => {
      $("#function-call-results").empty();
      parseAndAddResponse(result, $("#function-call-results"))
      $("#function-call-results").show();
    })
  }
}

var ui = new UI();
ui.init();
$(() => ui.run());
