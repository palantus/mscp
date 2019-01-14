var tcSelectedServer = null;

function initForward(){


  tcForwards = new TableCreator();
  tcForwards.init({	elementId: "ForwardDiv",
            clickable: false,
            showRecordsPerPageSelector: false,
            showFieldsSelector: false,
            columns: [
                  {title: "Remote id", dataKey: "server"},
                  {title: "Remote name", dataKey: "serverName"},
                  {title: "Remote namespace", dataKey: "namespace"},
                  {title: "Function", dataKey: "function"},
                  {title: "Local namespace", dataKey: "localnamespace"},
                  {title: "Forward access key", dataKey: "forwardAccessKey"}
                 ],
            dataSource: async function(onData){
               let response = await req('get-forwards');
               let forwards = await response.json()
               onData(forwards);
            },
            deleteRecord: {
              onDelete: async function(record, cb){await req("remove-forward", record);cb();}
            },
            editRecord: {
              fields: [
                {name: "forwardAccessKey", title: "Forward access key", type: "checkbox"}
              ],
              onEdit: async function(oldRecord, newRecord, cb){
                await req("update-forward", newRecord);
                cb();
              }
            },
          })
  tcForwards.draw();
}

$(function() {
  initForward();
});

function refreshForwards(){
  tcForwards.reloadData();
}
