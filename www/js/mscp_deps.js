var tcDeps = null;

function initDeps(){


  tcDeps = new TableCreator();
  tcDeps.init({	elementId: "DependenciesDiv",
            clickable: false,
            //linesPerPage: 20,
            showRecordsPerPageSelector: false,
            showFieldsSelector: true,
            columns: [
                  {title: "Namespace", dataKey: "namespace"},
                  {title: "Function", dataKey: "name"},
                  {title: "Arguments", dataKey: "arguments", width: "270px"},
                  {title: "Server ID", dataKey: "serverId", visible: false},
                  {title: "Server", dataKey: "serverName"}
                 ],
            dataSource: async function(onData){
               let response = await req('get-dependencies');
               let deps = await response.json()
               for(let f of deps){
                  f.arguments = formatFunctionArgsAsString(f.args);
               }
               onData(deps);
            },
            deleteRecord: {
              onDelete: async function(record, cb){await req("remove-dependency", record);cb();}
            },
            editRecord: {
              fields: [
                {name: "namespace", title: "Namespace"}
              ],
              onEdit: async function(oldRecord, newRecord, cb){
                newRecord.oldNamespace = oldRecord.namespace
                await req("update-dependency", newRecord);
                cb();
              }
            }
          })
  tcDeps.draw();
}

$(function() {
  initDeps();
});

function refreshDeps(){
  tcDeps.reloadData();
}
