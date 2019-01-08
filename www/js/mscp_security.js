var securityAreas = ["api", "static", "manage", "all"];
var securityAccessTypes = ["ip", "key", "none"];
var securityAccessPermissions = ["allow", "deny"];
var tcSecurityAccessSubRules = null;
var curAccess = null;

async function initSecurity(){

  /* Access Rules */

  let tcIPFilters = new TableCreator();
  tcIPFilters.init({	elementId: "AccessTable",
            clickable: true,
            showRecordsPerPageSelector: false,
            showFieldsSelector: true,
            columns: [
                  {title: "Id", dataKey: "id", visible: false},
                  {title: "Area", dataKey: "area"}, // Manage, API, *,
                  {title: "Description", dataKey: "description"},
                  {title: "IP address", dataKey: "ip"},
                  {title: "Require key", dataKey: "require_access_key"},
                  {title: "Default permission", dataKey: "default_permission"}
                 ],
            dataSource: async function(onData){
               let response = await req('get-access-rules');
               let data = await response.json()
               onData(data);
            },
            deleteRecord: {
              onDelete: async function(record, cb){
                await req("remove-access-rule", record);
                cb();
                $("#accesssubrules").hide();
                $("#accesskeys").hide();
              }
            },
            createRecord: {
              fields: [
                {name: "area", title: "Area", type: "select", values: securityAreas},
                {name: "description", title: "Description"},
                {name: "ip", title: "IP address", placeholder: "regexp or IP (optional)"},
                {name: "require_access_key", title: "Require access key", type: "checkbox"},
                {name: "default_permission", title: "Default permission", type: "select", values: securityAccessPermissions}
              ],
              onCreate: async function(record, cb){
                await req("add-access-rule", record);
                cb();
              }
            },
            editRecord: {
              fields: [
                {name: "area", title: "Area", type: "select", values: securityAreas},
                {name: "description", title: "Description"},
                {name: "ip", title: "IP address", placeholder: "regexp or IP (optional)"},
                {name: "require_access_key", title: "Require access key", type: "checkbox"},
                {name: "default_permission", title: "Default permission", type: "select", values: securityAccessPermissions}
              ],
              onEdit: async function(oldRecord, newRecord, cb){
                await req("update-access-rule", newRecord);
                cb();
                showAccess(newRecord)
              }
            },
            onClick: (r) => showAccess(r)
          })
  tcIPFilters.draw();

  /* Sub-rules */

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
                await req("remove-access-sub-rule", record);
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


  /* Access keys */

  tcSecurityAccessKeys = new TableCreator();
  tcSecurityAccessKeys.init({	elementId: "AccessKeysTable",
            clickable: true,
            showRecordsPerPageSelector: false,
            showFieldsSelector: true,
            columns: [
                  {title: "Id", dataKey: "id", visible: false},
                  {title: "Description", dataKey: "description"},
                  {title: "Key", dataKey: "key"}
                 ],
            dataSource: async function(onData){
              if(curAccess == null){
                onData([])
                return;
              }

              let response = await req('get-access-keys', {accessId: curAccess.id});
              let forwards = await response.json()
              onData(forwards);
            },
            deleteRecord: {
              onDelete: async function(record, cb){
                await req("remove-access-key", record);
                cb();
              }
            },
            createRecord: {
              fields: [
                {title: "Description", name: "description"},
                {title: "Key", name: "key", placeholder: "Leave blank for auto"}
              ],
              onCreate: async function(record, cb){
                record.accessId = curAccess.id;
                await req("add-access-key", {accessId: curAccess.id, rule: record});
                cb();
              }
            },
            onClick: (r) => prompt("Access key", r.key)
          })
  tcSecurityAccessKeys.draw();

  function showAccess(a){
    curAccess = a;
    $("#accesssubrules").show();
    if(curAccess.require_access_key)
      $("#accesskeys").show();
    else
      $("#accesskeys").hide();
    tcSecurityAccessSubRules.reloadData();
    tcSecurityAccessKeys.reloadData();
  }
}

$(function() {
  initSecurity();
});
