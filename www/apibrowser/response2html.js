function parseAndAddResponse(r, element, returnObjectAsRow){
  if(Array.isArray(r)){
    let tab = $("<table></table>", {class: "result-array"})

    let columnNames = []

    let thead = $("<thead></thead>")
    let headRow = $("<tr></tr>")

    if(r.length > 0){
      if(typeof r[0] === "object"){
        for(let n in r[0]){
          columnNames.push(n)
          headRow.append($("<th></th>", {html: n}))
        }

        thead.append(headRow)
        tab.append(thead);
      }

      for(let d of r){
        parseAndAddResponse(d, tab, true)
      }

      element.append(tab)
    }
  }

  else if(typeof r === "object" && returnObjectAsRow === true){
    let row = $("<tr></tr>")
    for(let n in r){
      let cell = $("<td></td>");
      parseAndAddResponse(r[n], cell);
      row.append(cell)
    }
    element.append(row)
  }

  else if(typeof r === "object"){
    //let tab = $("<table><thead><th>Property</th><th>Value</th></thead></table>", {class: "result-object"})
    let tab = $("<table></table>", {class: "result-object"})

    for(let n in r){
      let prop = $("<td></td>", {html: n})
      let equals = $("<td></td>", {html: "="})
      let val = $("<td></td>")
      parseAndAddResponse(r[n], val)
      let row = $("<tr></tr>")
      row.append(prop)
      row.append(equals)
      row.append(val)
      tab.append(row)
    }

    element.append(tab)
  }

  else {
    let ret = null;
    if(typeof r === "boolean")
      r = r === false ? "false" : "true"
    let htmlEncodedStr = htmlEncode(r)
    if(typeof r === "string" && htmlEncodedStr != r){
      ret = `<pre>${htmlEncodedStr}</pre>`
    } else {
      ret = r;
    }

    if(returnObjectAsRow === true){
      ret = $(`<tr><td>${r}</td></tr>`)
    }

    element.append(ret)
  }
}

function htmlEncode(s){
  var el = document.createElement("div");
  el.innerText = el.textContent = s;
  s = el.innerHTML;
  return s;
}
