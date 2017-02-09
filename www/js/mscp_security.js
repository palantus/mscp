let availableSecuritySchemes = ["full_access", "access_key", "ip_filter", "access_key_and_ip_filter"]
var securityAreas = ["api", "static", "manage", "all"];
var securityAccessTypes = ["ip", "key", "none"];
var securityAccessPermissions = ["allow", "deny"];
var tcSecurityAccessSubRules = null;
var curAccess = null;

async function initSecurity(){

  let tcIPFilters = new TableCreator();
  tcIPFilters.init({	elementId: "AccessTable",
            clickable: true,
            showRecordsPerPageSelector: false,
            showFieldsSelector: true,
            columns: [
                  {title: "Id", dataKey: "id", visible: false},
                  {title: "Area", dataKey: "area"}, // Manage, API, *,
                  {title: "Type", dataKey: "type"},
                  {title: "Description", dataKey: "description"},
                  {title: "IP/key", dataKey: "filter"},
                  {title: "Default permission", dataKey: "default_permission"}
                 ],
            dataSource: async function(onData){
               let response = await req('get-access-rules');
               let data = await response.json()
               onData(data);
            },
            deleteRecord: {
              onDelete: async function(record, cb){await req("remove-access-rule", record);cb();}
            },
            createRecord: {
              fields: [
                {name: "area", title: "Area", type: "select", values: securityAreas},
                {name: "type", title: "Type", type: "select", values: securityAccessTypes},
                {name: "description", title: "Description"},
                {name: "filter", title: "IP/key", placeholder: "IP (regexp) or access key"},
                {name: "default_permission", title: "Default permission", type: "select", values: securityAccessPermissions}
              ],
              onCreate: async function(record, cb){
                await req("add-access-rule", record);
                cb();
              }
            },
            onClick: (r) => showAccess(r)
          })
  tcIPFilters.draw();

  tcSecurityAccessSubRules = new TableCreator();
  tcSecurityAccessSubRules.init({	elementId: "AccessSubRulesTable",
            clickable: false,
            showRecordsPerPageSelector: false,
            showFieldsSelector: true,
            columns: [
                  {title: "Id", dataKey: "id", visible: false},
                  {title: "Path", dataKey: "path"},
                  {title: "Parameters", dataKey: "parameters"},
                  {title: "Permission", dataKey: "permission", type: "select", values: securityAccessPermissions}
                 ],
            dataSource: async function(onData){
              if(curAccess == null){
                onData([])
                return;
              }

              let response = await req('get-access-sub-rules', {accessId: curAccess.id});
              let forwards = await response.json()
              onData(forwards);
            },
            deleteRecord: {
              onDelete: async function(record, cb){
                await req("remove-access-sub-rule", {accessId: curAccess.id, ruleId: record.id});
                cb();
              }
            },
            createRecord: {
              fields: [
                {title: "Path", name: "path", placeholder: "Can end with *"},
                {title: "Parameters", name: "parameters", type: "textarea", placeholder:"var=value. Prefix value with $ for regexp. Seperate with line breaks.", style: {width: "250px", height: "50px"}},
                {title: "Permission", name: "permission", type: "select", values: securityAccessPermissions}
              ],
              onCreate: async function(record, cb){
                record.accessId = curAccess.id;
                await req("add-access-sub-rule", {accessId: curAccess.id, rule: record});
                cb();
              }
            }
          })
  tcSecurityAccessSubRules.draw();

  function showAccess(a){
    curAccess = a;
    $("#accesssubrules").show();
    tcSecurityAccessSubRules.reloadData();
  }
}

$(function() {
  initSecurity();
});
