let availableSecuritySchemes = ["full_access", "access_key", "ip_filter", "access_key_and_ip_filter"]

async function initSecurity(){
  refreshVisibleSecurityGroups();
  $("button.savebasic").click(() => refreshVisibleSecurityGroups());

  let tcIPFilters = new TableCreator();
  tcIPFilters.init({	elementId: "IPFiltersTable",
            clickable: false,
            showRecordsPerPageSelector: false,
            showFieldsSelector: false,
            columns: [
                  {title: "Id", dataKey: "id", visible: false},
                  {title: "Description", dataKey: "description"},
                  {title: "IP filter", dataKey: "filter"},
                  {title: "Area", dataKey: "area"} // Manage, API, *
                  //{title: "Functions", dataKey: "functions"} //regexp
                 ],
            dataSource: async function(onData){
               let response = await req('get-ip-filters');
               let forwards = await response.json()
               onData(forwards);
            },
            deleteRecord: {
              onDelete: async function(record, cb){await req("remove-ip-filter", record);cb();}
            },
            createRecord: {
              fields: [
                {name: "description", title: "Description"},
                {name: "filter", title: "IP filter", placeholder: "regexp"},
                {name: "area", title: "Area", type: "select", values: securityAreas}
                //{name: "functions", title: "Functions", placeholder: "Func. names (optional)"}
              ],
              onCreate: async function(record, cb){
                await req("add-ip-filter", record);
                cb();
              }
            }
          })
  tcIPFilters.draw();

  let tcAccessKeys = new TableCreator();
  tcAccessKeys.init({	elementId: "AccessKeysTable",
            clickable: true,
            showRecordsPerPageSelector: false,
            showFieldsSelector: false,
            columns: [
                  {title: "Id", dataKey: "id", visible: false},
                  {title: "Description", dataKey: "description"},
                  {title: "Access key", dataKey: "accessKey"},
                  {title: "Area", dataKey: "area"} // Manage, API, *
                  //{title: "Functions", dataKey: "functions"} //regexp
                 ],
            dataSource: async function(onData){
               let response = await req('get-access-keys');
               let forwards = await response.json()
               onData(forwards);
            },
            deleteRecord: {
              onDelete: async function(record, cb){await req("remove-access-key", record);cb();}
            },
            createRecord: {
              fields: [
                {name: "description", title: "Description"},
                {name: "area", title: "Area", type: "select", values: securityAreas}
                //{name: "functions", title: "Functions", placeholder: "Func. names (optional)"}
              ],
              onCreate: async function(record, cb){
                await req("add-access-key", record);
                cb();
              }
            },
            onClick: (r) => prompt("Access key", r.accessKey)
          })
  tcAccessKeys.draw();
}

function refreshVisibleSecurityGroups(){
  /*
  let apiScheme = $("#api_access_scheme").val()
  let manageScheme = $("#manage_access_scheme").val()
  let showAccessKeys = false;
  let showIPFilters = false;
  if([2, 3].indexOf(availableSecuritySchemes.indexOf(apiScheme)) >= 0 || [2, 3].indexOf(availableSecuritySchemes.indexOf(manageScheme)) >= 0){
    //Uses IP filter
    showIPFilters = true;
  }
  if([1, 3].indexOf(availableSecuritySchemes.indexOf(apiScheme)) >= 0 || [1, 3].indexOf(availableSecuritySchemes.indexOf(manageScheme)) >= 0){
    //Uses Access key
    showAccessKeys = true;
  }

  if(showAccessKeys)
    $("#accesskeys").show();
  else
    $("#accesskeys").hide();

  if(showIPFilters)
    $("#ipfilters").show();
  else
    $("#ipfilters").hide();
  */
}

$(function() {
  initSecurity();
});
