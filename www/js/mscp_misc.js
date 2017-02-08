async function initMisc(){

  $("button.savebasic").click(async function(){
    req("set-basic-info", {
      name: $("#name").val(),
      http_port: $("#http_port").val(),
      https_port: $("#https_port").val(),
      enableHTTP: $("#enableHTTP").is(':checked'),
      enableHTTPS: $("#enableHTTPS").is(':checked'),
      https_key: $("#https_key").val(),
      https_cert: $("#https_cert").val(),
      https_ca: $("#https_ca").val(),
      api_access_scheme: $("#api_access_scheme").val(),
      manage_access_scheme: $("#manage_access_scheme").val()
    });
  })

  let info = await (await req("get-basic-info")).json();
  $("#name").val(info.name);
  $("#http_port").val(info.http_port);
  $("#https_port").val(info.https_port);
  $("#enableHTTP").prop('checked', info.enableHTTP);
  $("#enableHTTPS").prop('checked', info.enableHTTPS);
  $("#https_key").val(info.https_key);
  $("#https_cert").val(info.https_cert);
  $("#https_ca").val(info.https_ca);
  $("#api_access_scheme").val(info.api_access_scheme);
  $("#manage_access_scheme").val(info.manage_access_scheme);

  refreshVisibleSecurityGroups();
}

$(function() {
  initMisc();
});
