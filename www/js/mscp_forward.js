var tcSelectedServer = null;

function initForward(){


  tcForwards = new TableCreator();
  tcForwards.init({	elementId: "ForwardDiv",
            clickable: false,
            showRecordsPerPageSelector: false,
            showFieldsSelector: false,
            columns: [
                  {title: "Server", dataKey: "server"},
                  {title: "Namespace", dataKey: "namespace"},
                  {title: "Function", dataKey: "function"}
                 ],
            dataSource: async function(onData){
               let response = await req('get-forwards');
               let forwards = await response.json()
               onData(forwards);
            },
            deleteRecord: {
              onDelete: async function(record, cb){await req("remove-forward", record);cb();}
            }
          })
  tcForwards.draw();
}

$(function() {
  initForward();
});

function refreshForwards(){
  tcForwards.reloadData();
}
