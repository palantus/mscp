"use strict"

class ActionHandler{
  constructor(item, parentHandler){
    this.item = item
    this.parentHandler = parentHandler !== undefined ? parentHandler : null;
    this.element = null;
  }

  destroy(){
    this.element.remove();
    this.item = undefined;
    this.parentHandler = undefined;
    this.element = undefined;
  }

  show(){
    $("#content div.itemcontainer").hide();

    if(this.element != null){
      this.element.show()
      return;
    }

    this.element = $(`<div class="itemcontainer">
                        <div class="itemtitle"></div>
                        <div class="function-call-container">
                          <div class="function-call-args"></div>
                          ${this.parentHandler ? '<button class="function-call-back">Back</button>' : ""}
                          <button class="function-call-execute">${this.item.item.autorun === true ? "Rerun" : "Go"}</button>
                          <div class="function-call-results"></div>
                        </div>
                      </div>`)
    $("#content").append(this.element)
    this.element.find("button.function-call-execute").click(() => this.run());
    this.element.find("button.function-call-back").click(() => this.back());

    this.element.find(".itemtitle").html(this.item.title)

    this.element.find(".function-call-args").empty();
    this.element.find(".function-call-results").hide();
    this.element.find(".function-call-execute").show();

    if(this.item.serve.args === undefined || this.item.serve.args.length < 1){
      this.element.find(".function-args").hide();
      this.element.find(".function-call-args").empty();
    } else {
      this.element.find(".function-args tbody").empty();
      this.element.find(".function-args tbody").show();

      for(let a of this.item.serve.args){
        let elementStr = null;
        let defaultValue = (((this.item.item.args||{})[a.name])||{})["default"]
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
            defaultValue = (typeof defaultValue === "object" ? JSON.stringify(defaultValue, null, 2) : this.item.item.default) || "";
            elementStr = `<textarea data-arg="${a.name}" value="${defaultValue}" placeholder="JSON Object"/>`;
            break;
          case "array":
            defaultValue = (typeof defaultValue === "object" ? JSON.stringify(defaultValue, null, 2) : this.item.item.default) || "";
            elementStr = `<textarea data-arg=$"${a.name}" value="${defaultValue}" placeholder="JSON Array"/>`;
            break;
          default:
            alert(`Unsupported argument type: ${a.type}`);
        }

        if(elementStr != null){
          let title = ((this.item.item.args !== undefined && this.item.item.args[a.name] !== undefined) ? this.item.item.args[a.name].title : undefined) || a.title || a.name;
          let element = $(`<div class="function-call-arg-container"><span class="function-call-arg-name">${title}:</span>${elementStr}<span class="tooltiptext">${a.description}</span></div>`)
          this.element.find(".function-call-args").append(element)
          this.element.find(".function-call-args input:first").focus();
        }
      }
    }
    this.element.show();
    if(this.item.item.autorun === true)
      this.run();
  }

  async run(){
    let args = this.item.serve.args || []
    let data = []
    for(let a of args){
      let val = null;

      if(!this.element){
        let defaultValue = (((this.item.item.args||{})[a.name])||{})["default"]
        data.push(defaultValue || null)
        continue;
      }

      switch(a.type){
        case "string":
        case "*":
          val = this.element.find(`.function-call-arg-container [data-arg="${a.name}"]`).val()
          break;
        case "integer":
          val = parseInt(this.element.find(`.function-call-arg-container [data-arg="${a.name}"]`).val())
          break;
        case "float":
          val = parseFloat(this.element.find(`.function-call-arg-container [data-arg="${a.name}"]`).val())
          break;
        case "boolean":
          val = this.element.find(`.function-call-arg-container [data-arg="${a.name}"]`).is(":checked");
          break;
        case "object":
        case "array":
          try{
            let jsonStr = this.element.find(`.function-call-arg-container [data-arg="${a.name}"]`).val()
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
    let obj = this.item.serve.namespace ? mscp[this.item.serve.namespace] : mscp
    //obj[this.item.serve.name].apply(mscp, data).then((result) => {
    let result = await obj[this.item.serve.name].apply(mscp, data);
    result = this.transformResults(result)
    if(this.element){
      this.element.find(".function-call-results").empty();
      new ResultParser(this, this.item, result, this.element.find(".function-call-results")).parse()
      this.element.find(".function-call-results").show();
    }
    return result;
    //})
  }

  transformResults(result){
    if(!result && result !== false)
      return (this.item.item.result || {}).emptyText || "<empty response>"
    else if(Array.isArray(result) && result.length == 0)
      return (this.item.item.result || {}).emptyText || "<empty array>"
    else if(Object.keys(result).length === 0 && result.constructor === Object)
      return (this.item.item.result || {}).emptyText || "<empty object>"

    if(this.item.item.result === undefined)
      return result;

    if(Array.isArray(result)){
      let columns = this.item.item.result.columns || {}
      for(let c in columns){
        for(let row of result){
          row[columns[c]] = row[c];
          delete row[c];
        }
      }
    } else if(typeof result === "object"){
      let properties = this.item.item.result.properties || {}
      for(let c in properties){
        result[properties[c]] = result[c];
        delete result[c];
      }
    }
    return result;
  }

  back(){
    this.parentHandler.show();
    this.destroy();
  }
}
