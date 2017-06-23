"use strict"

class ResultParser{
  constructor(actionHandler, item, result, element){
    this.item = item;
    this.actions = item.item.actions;
    this.result = result;
    this.element = element;
    this.actionHandler = actionHandler;
  }

  parse(){
    return this.parseInner(this.result, this.element, "")
  }

  parseInner(r, element, path, returnObjectAsRow){
    if(Array.isArray(r)){
      let tab = $("<table></table>", {class: "result-array"})

      let columnNames = []

      let thead = $("<thead></thead>")
      let headRow = $("<tr></tr>")

      if(r.length > 0){
        if(typeof r[0] === "object"){
          for(let n in r[0]){
            columnNames.push(n)
            headRow.append($("<th></th>", {html: n}))
          }

          thead.append(headRow)
          tab.append(thead);
        }

        for(let d of r){
          this.parseInner(d, tab, this.addToPath(path, "<row>"), true)
        }

        element.append(tab)
      }
    }

    else if(typeof r === "object" && returnObjectAsRow === true){
      let row = $("<tr></tr>")
      for(let n in r){
        let cell = $("<td></td>");
        this.parseInner(r[n], cell, this.addToPath(path, n));
        row.append(cell)
      }

      this.applyActionToElement(path, row, r)
      element.append(row)
    }

    else if(typeof r === "object"){
      let tab = $("<table></table>", {class: "result-object"})

      for(let n in r){
        let prop = $("<td></td>", {html: n})
        let equals = $("<td></td>", {html: "="})
        let val = $("<td></td>")
        this.parseInner(r[n], val, this.addToPath(path, n))
        let row = $("<tr></tr>")
        row.append(prop)
        row.append(equals)
        row.append(val)
        tab.append(row)
      }

      element.append(tab)
    }

    else {
      let ret = null;
      if(typeof r === "boolean")
        r = r === false ? "false" : "true"
      let htmlEncodedStr = this.htmlEncode(r)
      if(typeof r === "string" && htmlEncodedStr != r){
        ret = `<pre>${htmlEncodedStr}</pre>`
      } else {
        ret = r;
      }

      if(returnObjectAsRow === true){
        ret = $(`<tr><td>${r}</td></tr>`)
      }

      element.append(ret)

      this.applyActionToElement(path, element, r)
    }
  }

  applyActionToElement(path, element, activeObj){
    if(this.actions === undefined || this.actions[path] === undefined)
      return;

    element.addClass("clickable")
    element.click((e) => {
      let bar = $("#floatingactionbar-actions");
      bar.empty();

      for(let a of this.actions[path]){
        if(a.rundirectly === true){
          this.executeAction(a, activeObj)
          return;
        }
        let e = $("<p/>", {html: a.title, class: "clickable"})
        e.click(() => this.executeAction(a, activeObj));
        bar.append(e)
      }
      $("#floatingactionbar > div").css({top: e.clientY, left: e.clientX, transform: "inherit"})
      $("#floatingactionbar").removeClass("hidden");
    })
  }

  async executeAction(action, activeObj){
    //{"type": "click", "call": "definition", "args": {"name": "<row>.name"}}
    $("#floatingactionbar").addClass("hidden");

    if(action.type == "link"){
      let url = action.url;
      if(typeof activeObj === "object" && !Array.isArray(activeObj)){
        for(let a in activeObj){
          url = url.replace(`<active.${a}>`, activeObj[a]);
        }
        url = url.replace("<curhost>", `${window.location.protocol}//${window.location.hostname}${!isNaN(window.location.port) ? ":" + window.location.port : ""}`)
        url = url.replace("<curhostnoport>", `${window.location.protocol}//${window.location.hostname}`)
        window.open(url, '_blank').focus();
      }
      return;
    }

    let serverAction = ui.actions[action.call];

    if(!serverAction){
      let item = ui.items[action.call] || {}
      if(!item.name)
        item.name = action.call
      if(item.name.indexOf(".")>0)
        [item.namespace, item.name] = item.name.split(".");

      serverAction = {};
      serverAction.item = item;
      serverAction.serve = mscp.def.serve.find((serv) => serv.namespace ? (serv.name == serverAction.item.name && serv.namespace == serverAction.item.namespace) : serv.name == serverAction.item.name);
      serverAction.title = serverAction.item.title || serverAction.serve.title || ""
    }

    if(serverAction.item.autorun !== false && action.autorun !== false)
      serverAction.item.autorun = true;

    if(!serverAction){
      alert("Invalid call action")
      return;
    }

    serverAction = JSON.parse(JSON.stringify(serverAction));

    if(typeof action.args === "object"){
      for(let a in action.args){
        if(serverAction.item.args === undefined){
          serverAction.item.args = {}
        }
        if(serverAction.item.args[a] === undefined){
          serverAction.item.args[a] = {}
        }
        serverAction.item.args[a].default = this.getValueByPath(activeObj, action.args[a]);
      }
    }

    let ah = new ActionHandler(serverAction, this.actionHandler)
    switch(action.ui){
      case "notify-result":
        let result = await ah.run();
        if(typeof result === "object" || Array.isArray(result))
          result = JSON.stringify(result);
        notify(result);
        break;
      default:
        ah.show();
    }

  }

  getValueByPath(active, path){
    let s = path.split(".");
    if(s.length == 2 && s[0] == "active"){
      return active[s[1]];
    } else if(s.length == 1 && s[0] == "active"){
      return active;
    } else {
      alert("Unsupported action path");
    }
  }

  addToPath(path, add){
    return path ? path + "." + add : add;
  }

  htmlEncode(s){
    var el = document.createElement("div");
    el.innerText = el.textContent = s;
    s = el.innerHTML;
    return s;
  }
}
