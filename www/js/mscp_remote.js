function initRemote(){

  var tcServers = new TableCreator();
  tcServers.init({	elementId: "ServersDiv",
            clickable: true,
            //linesPerPage: 20,
            showRecordsPerPageSelector: false,
            showFieldsSelector: true,
            sortable: false,
            columns: [
                  {title: "Id", dataKey: "id", visible: false},
                  {title: "Name", dataKey: "name"},
                  {title: "Type", dataKey: "type"},
                  {title: "URL", dataKey: "url", visible: false},
                  {title: "Namespace", dataKey: "namespace"},
                  {title: "Access key", dataKey: "accesskey", visible: false},
                  {title: "Forward accesskey", dataKey: "forwardAccessKeyShow", visible: false},
                  {title: "Running", dataKey: "running"},
                  {title: "Enabled", dataKey: "enabled"}
                 ],
            createRecord: {
              fields: [
                {name: "type", title: "Type", type: "select", values: ["http", "websocket-client", "websocket-server"], onChange: function(newVal, control, popup){
                  if(newVal == "http"){
                    popup.find("input[name=accesskey]").parent().parent().show();
                    popup.find("input[name=url]").parent().parent().show();
                  } else if(newVal == "websocket-server"){
                    popup.find("input[name=accesskey]").parent().parent().show();
                    popup.find("input[name=url]").parent().parent().show();
                  } else if(newVal == "websocket-client"){
                    popup.find("input[name=accesskey]").parent().parent().show();
                    popup.find("input[name=url]").parent().parent().hide();
                  }

                  if(newVal == "websocket-client"){
                    popup.find("input[name=accesskey]").val(guid())
                    popup.find("input[name=name]").parent().parent().show();
                  } else {
                    popup.find("input[name=accesskey]").val("")
                    popup.find("input[name=name]").parent().parent().hide();
                  }
                }},
                {name: "name", title: "Name", visible: false},
                {name: "url", title: "URL"},
                {name: "namespace", title: "Namespace"},
                {name: "accesskey", title: "Access key"},
                {name: "enabled", title: "Enabled", type: "checkbox"},
                {name: "forwardAccessKey", title: "Forward access key", type: "checkbox"}
              ],
              validate: function(record){
                if(record.type == "http")
                  return record.url !== "" ? true : "Missing URL";
                else
                  return true;
              },
              onCreate: async function(record, cb){
                await req("add-server", record);
                cb();
              }
            },
            deleteRecord: {
              onDelete: async function(record, cb){await req("remove-server", record);cb();}
            },
            dataSource: async function(onData){
              let response = await req('get-servers-with-status');
              let status = await response.json()
              for(s of status) s.running = s.running ? "Yes" : "No"
              for(s of status) s.enabled = s.enabled ? "Yes" : "No"
              for(s of status) s.websocket = s.websocket ? "Yes" : "No"
              for(s of status) s.forwardAccessKeyShow = s.forwardAccessKey ? "Yes" : "No"
              onData(status);
            },
            editRecord: {
              fields: [
                {name: "name", title: "Name"},
                {name: "namespace", title: "Namespace"},
                {name: "enabled", title: "Enabled", type: "checkbox"},
                {name: "accesskey", title: "Access key"},
                {name: "forwardAccessKey", title: "Forward access key", type: "checkbox"}
              ],
              onEdit: async function(oldRecord, newRecord, cb){
                await req("update-server", newRecord);
                cb();
              }
            },
            recordRightClickMenu: {actions: [
              {title: "Open in API browser", onClick: async function(a, r, cb){
                if(r.type == "http"){
                  var win = window.open(r.url + "/mscp/apibrowser", '_blank');
                  win.focus();
                } else {
                  notify("Only possible for http")
                }
              }},
              {title: "Refresh info", onClick: async function(a, r, cb){
                await req("refresh-server", r);
                cb();
              }},
              {title: "Add all func. as dep.", onClick: async function(a, r, cb){
                await req("add-all-server-func-as-dep", r);
                cb();
                refreshDeps();
              }},
              {title: "Configure", onClick: async function(a, r, cb){
                window.location = "/mscp/?remoteServer=" + r.id;
              }}
            ]},
            onClick: function(record){
              showServer(record)
            }
          });
  tcServers.draw();

  var tcSelectedServer = new TableCreator();
  tcSelectedServer.init({	elementId: "CurServerFunctions",
            clickable: true,
            //linesPerPage: 20,
            showRecordsPerPageSelector: false,
            showFieldsSelector: true,
            columns: [
                  {title: "Namespace", dataKey: "namespace"},
                  {title: "Name", dataKey: "name"},
                  {title: "Arguments", dataKey: "arguments", width: "270px"}
                 ],
            dataSource: async function(onData){
              if(curSelectedServer != null){
                 let response = await req('get-server-definition', curSelectedServer);
                 let def = await response.json()
                 if(def.error === undefined){
                   for(let f of def.serve){
                      f.arguments = formatFunctionArgsAsString(f.args);
                   }
                   let serverFunctionsSorted = def.serve.sort((s1, s2) => s1.namespace < s2.namespace ? -1 : s1.namespace == s2.namespace && s1.name < s2.name ? -1 : 1 )
                   onData(serverFunctionsSorted);
                 } else {
                   onData([])
                   new Notifier().show(def.error)
                 }
              } else {
                onData([]);
              }
            },
            recordRightClickMenu: {actions: [
              {title: "Add as dependency", onClick: async function(a, r, cb){
                delete r.arguments;
                await req("add-server-func-as-dep", {serverId: curSelectedServer.id, serverNamespace: curSelectedServer.namespace, func: r, id: curSelectedServer.id});
                cb();
                refreshDeps();
              }},
              {title: "Forward", onClick: async function(a, r, cb){
                delete r.arguments;
                await req("add-forward", {server: curSelectedServer.id, function: r.name, namespace: r.namespace});
                cb();
                refreshForwards();
              }}
            ]},
          })
  tcSelectedServer.draw();

  var curSelectedServer = null;
  var showServer = function(server){
     $("#selectedservercontainer").fadeIn();
     curSelectedServer = server;
     tcSelectedServer.reloadData();
   }
 }

 $(function() {
   initRemote();
 });
