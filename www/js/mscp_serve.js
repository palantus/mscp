var tcServes = null;
var tcSelectedServe = null;

function initServe(){

  tcServes = new TableCreator();
  tcServes.init({	elementId: "ServesDiv",
            clickable: true,
            //linesPerPage: 20,
            showRecordsPerPageSelector: false,
            showFieldsSelector: false,
            orderByColumn: 0,
            orderASC: true,
            columns: [
                  {title: "Namespace", dataKey: "namespace"},
                  {title: "Name", dataKey: "name"},
                  {title: "Title", dataKey: "title"},
                  {title: "Arguments", dataKey: "arguments", width: "270px"},
                  {title: "Description", dataKey: "description"},
                  {title: "Return type", dataKey: "returntype"},
                  {title: "Default", dataKey: "default"}
                 ],
            dataSource: async function(onData){
               let response = await req('get-serve');
               let serve = await response.json()
               for(let f of serve){
                  f.arguments = formatFunctionArgsAsString(f.args);
               }
               onData(serve);
            },
            createRecord: {
              fields: [
                {name: "name", title: "Name"},
                {name: "title", title: "Title", placeholder: "optional"},
                {name: "description", title: "Description", type: "textarea"},
                {name: "returntype", title: "Return type", type: "select", values: dataTypesForSelect},
                {name: "namespace", title: "Namespace"},
                {name: "default", title: "Default for", type: "select", values: httpOperationsForSelect}
              ],
              validate: function(record){return record.name !== ""},
              onCreate: async function(record, cb){
                await req("add-serve", record);
                cb();
              }
            },
            deleteRecord: {
              onDelete: async function(record, cb){await req("remove-serve", record);cb();}
            },
            editRecord: {
              fields: [
                {name: "name", title: "Name"},
                {name: "title", title: "Title", placeholder: "optional"},
                {name: "description", title: "Description", type: "textarea"},
                {name: "returntype", title: "Return type", type: "select", values: dataTypesForSelect},
                {name: "namespace", title: "Namespace"},
                {name: "default", title: "Default for", type: "select", values: httpOperationsForSelect}
              ],
              validate: function(oldRecord, newRecord){return newRecord.name !== "";},
              onEdit: async function(oldRecord, newRecord, cb){
                newRecord.oldName = oldRecord.name;
                newRecord.oldNamespace = oldRecord.namespace;
                await req("update-serve", newRecord);
                cb();
              }
            },
            onClick: function(record){
              showServe(record)
            },
            recordRightClickMenu: {actions: [
              {title: "Call function", onClick: async function(a, r, cb){
                let strWindowFeatures = "location=yes,height=570,width=520,scrollbars=yes,status=yes";
                let URL = `/mscp/apibrowser?setup=1110000;${r.name}`;
                let win = window.open(URL, "_blank", strWindowFeatures);
              }}
            ]}
          })
  tcServes.draw();

  tcSelectedServe = new TableCreator();
  tcSelectedServe.init(
    {
      elementId: "CurServeArgs",
      showRecordsPerPageSelector: false,
      showFieldsSelector: false,
      columns: [
        {title: "Name", dataKey: "name"},
        {title: "Title", dataKey: "title"},
        {title: "Type", dataKey: "type"},
        {title: "Required", dataKey: "required"},
        {title: "Description", dataKey: "description"}
      ],
      dataSource: async function(onData){
        if(curSelectedServe != null){
          let response = await req('get-serve-arguments', curSelectedServe);
          let args = await response.json()
          for(let i = 0; i < args.length; i++){
            if(typeof args[i] === "string"){
              args[i] = {name: args[i]};
            }
            args[i].required = (typeof args[i].required === "boolean") ? args[i].required : true;
            args[i].type = (typeof args[i].type === "string") ? args[i].type : "*";
          }
          onData(args);
        } else {
          onData([]);
        }
      },
      createRecord: {
        fields: [
          {name: "name", title: "Name"},
          {name: "title", title: "Title", placeholder: "optional"},
          {name: "type", title: "Type", type: "select", values: dataTypesForSelect},
          {name: "required", title: "Required", type: "checkbox"},
          {name: "description", title: "Description", type: "textarea"}
        ],
        validate: function(record){return record.name !== ""},
        onCreate: async function(record, cb){
          await req("add-serve-argument", {servename: curSelectedServe.name, servenamespace: curSelectedServe.namespace, record: record});
          cb();
          refreshServe();
        }
      },
      deleteRecord: {
        onDelete: async function(record, cb){await req("remove-serve-argument", {servename: curSelectedServe.name, servenamespace: curSelectedServe.namespace, record: record});cb();refreshServe();}
      },
      editRecord: {
        fields: [
          {name: "name", title: "Name"},
          {name: "title", title: "Title", placeholder: "optional"},
          {name: "type", title: "Type", type: "select", values: dataTypesForSelect},
          {name: "required", title: "Required", type: "checkbox"},
          {name: "description", title: "Description", type: "textarea"}
        ],
        validate: function(oldRecord, newRecord){return newRecord.name !== "";},
        onEdit: async function(oldRecord, newRecord, cb){
          newRecord.oldName = oldRecord.name;
          await req("update-serve-argument", {servename: curSelectedServe.name, servenamespace: curSelectedServe.namespace, record: newRecord});
          cb();
          refreshServe();
        }
      }
    })
  tcSelectedServe.draw();

  var curSelectedServe = null;
  var showServe = function(serve){
     $("#servecurrentfunctionname").html((serve.namespace?serve.namespace+".":"") + serve.name)
     $("#selectedservecontainer").fadeIn();
     curSelectedServe = serve;
     tcSelectedServe.reloadData();
   }

   $("#GenHandlerBtn").click(async function(){
     let response = await req('get-serve');
     let serve = await response.json()

     var handlerCode = "\"use strict\"\r\n\r\nclass Handler{\r\n"
                     + "\r\n  async init(){\r\n    // Initialize handler if necessary. Is called on every request\r\n  }\r\n"
                     + "\r\n  async initFirst(){\r\n    // Initialize handler if necessary. Is called only once (before any requests).\r\n  }\r\n";

     for(let s of serve){
       handlerCode += "\r\n  async " + s.name + "("

       let args = []
       for(let a of (s.args || [])){
         args.push(typeof a === "string" ? a : a.name)
       }

       handlerCode += args.join(', ')
       handlerCode += "){\r\n    return null\r\n  }\r\n"
     }

     handlerCode += "}\r\n\r\nmodule.exports = Handler"

     $("#generatedhandler").html(handlerCode)
   })
}

$(function() {
  initServe();
});

function refreshServe(){
  tcServes.reloadData();
  tcSelectedServe.reloadData();
}
