var tcDeps = null;

function initDeps(){


  tcDeps = new TableCreator();
  tcDeps.init({	elementId: "DependenciesDiv",
            clickable: false,
            //linesPerPage: 20,
            showRecordsPerPageSelector: false,
            showFieldsSelector: true,
            columns: [
                  {title: "Server ID", dataKey: "serverId", visible: false},
                  {title: "Server", dataKey: "serverName"},
                  {title: "Function", dataKey: "name"},
                  {title: "Arguments", dataKey: "arguments", width: "270px"},
                  {title: "Namespace", dataKey: "namespace"}
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
                {name: "namespace", title: "Namespace"},
                {name: "serverId", title: "Server ID"}
              ],
              onEdit: async function(oldRecord, newRecord, cb){
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
