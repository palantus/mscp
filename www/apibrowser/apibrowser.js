let curServe = null;
let setup = {}

$(function() {
  loadSetup();
  mscp.ready.then(init)
});

function init(){
  for(let s of mscp.def.serve){
    let functionDiv = $("<div></div>", {class: "function"});
    if(setup.useFunctionTitles && s.title)
      functionDiv.html(s.title + (setup.showFunctionNames ? ` (${s.name})` : ''));
    else
      functionDiv.html(s.name);
    functionDiv.data("serve", s)
    functionDiv.click(onFunctionClick)
    $("#functionlist").append(functionDiv);

    if(s.name == setup.defaultFunction){
      functionDiv.click();
      if(setup.autoRun === true){
        $("#function-call-execute").hide();
        runFunction()
      }
    }
  }
  $("#function-call-execute").click(runFunction);

  if(!setup.showJSONDefinition)     $("#function-json").hide();
  if(!setup.showArguments)          $("#argumentscontainer").hide();
  if(!setup.showCallFunctionHeader) $("#function-call-container .right-sub-header").hide();
  if(!setup.showFunctionList)       $("#functionlist").hide();
  if(!setup.showPageHeader)         $("#pageheaderlink").hide();
}

function onFunctionClick(){
  $("#rightcontent").show();
  let serve = $(this).data("serve");
  curServe = serve;

  let functionTitle = ""
  if(setup.useFunctionTitles && serve.title)
    functionTitle = serve.title;
  else {
    functionTitle = serve.name;
  }
  if(setup.showFunctionReturnType)
    functionTitle += ` (${serve.returntype})`;

  $("#function-name").html(functionTitle)
  $("#function-description").html(serve.description)
  $("#function-json pre").html(JSON.stringify(serve, null, 2))

  $("#function-call-args").empty();
  $("#function-call-results").hide();
  $("#function-call-execute").show();

  if(serve.args === undefined || serve.args.length < 1){
    $("#no-args-message").show();
    $("#function-args").hide();
    $("#function-call-args").empty();
  } else {
    $("#no-args-message").hide();
    $("#function-args tbody").empty();
    $("#function-args tbody").show();

    for(let a of serve.args){
      let row = $("<tr></tr>");
      row.append(`<td>${a.name}</td>`);
      row.append(`<td>${a.title}</td>`);
      row.append(`<td>${a.type}</td>`);
      row.append(`<td>${a.required === false ? "No" : "Yes"}</td>`);
      row.append(`<td>${a.description}</td>`);
      $("#function-args tbody").append(row);

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
        let title = (setup.useArgumentTitles && a.title) ? a.title : a.name;
        element = $(`<div class="function-call-arg-container"><span class="function-call-arg-name">${title}:</span>${elementStr}<span class="tooltiptext">${a.description}</span></div>`)
        $("#function-call-args").append(element)
      }
    }
  }

}

function runFunction(){
  let args = curServe.args || []
  let data = []
  for(let a of args){
    let val = null;

    switch(a.type){
      case "string":
      case "*":
        val = $(`.function-call-arg-container [data-arg="${a.name}"]`).val()
        val = val == "" ? null : val
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
  mscp[curServe.name].apply(mscp, data).then((result) => {
    $("#function-call-results").empty();
    parseAndAddResponse(result, $("#function-call-results"))
    //let strValue = typeof result === "object" ? JSON.stringify(result, null, 2) : result
    //$("#function-call-results").html(strValue)
    $("#function-call-results").show();
  })
}

function loadSetup(){
  let savedValue = (getUrlVar("setup") || "0011111110")
  let splits = savedValue.split(";")
  let boolValues = splits[0];
  setup = {
    useFunctionTitles:      boolValues[0] == "1",
    useArgumentTitles:      boolValues[1] == "1",
    showFunctionNames:      boolValues[2] == "1",
    showJSONDefinition:     boolValues[3] == "1",
    showArguments:          boolValues[4] == "1",
    showCallFunctionHeader: boolValues[5] == "1",
    showFunctionReturnType: boolValues[6] == "1",
    showFunctionList:       boolValues[7] == "1",
    showPageHeader:         boolValues[8] == "1",
    autoRun:                boolValues[9] == "1",
    defaultFunction:        (typeof splits[1] === "string" && splits[1].length > 0) ? splits[1] : null
  }
}

function saveSetup(){

}

function getUrlVar( name ){
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( window.location.href );
    if( results == null )
        return undefined;
    else
        return decodeURIComponent(results[1]);
}
