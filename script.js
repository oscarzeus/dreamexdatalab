document.addEventListener("DOMContentLoaded", function () {
    let canvas = document.getElementById("dataChart");
    let ctx = canvas.getContext("2d");

    // Set canvas dimensions
    canvas.width = 400;
    canvas.height = 200;

    // Sample Bar Chart
    let data = [10, 20, 15, 30, 25];
    let labels = ["A", "B", "C", "D", "E"];

    ctx.fillStyle = "#008cba";

    for (let i = 0; i < data.length; i++) {
        ctx.fillRect(i * 80 + 20, canvas.height - data[i] * 5, 50, data[i] * 5);
    }

    ctx.fillStyle = "black";
    ctx.font = "16px Arial";

    for (let i = 0; i < labels.length; i++) {
        ctx.fillText(labels[i], i * 80 + 35, canvas.height - 5);
    }
});

function fetchMondayUsers() {
    const query = `
      query {
        boards(ids: 1813057547) {
          items {
            id
            name
            column_values(ids: ["texte_mkmxvc5j","texte_mkmznxcs","texte_mkmxdczk", "texte_new_role", "texte_new_status"]) {
              id
              text
            }
          }
        }
      }`;
              
    fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjMzOTIzODIyNywiYWFpIjoxMSwidWlkIjo1MTA5MzU3NCwiaWFkIjoiMjAyNC0wMy0yOFQxMjo0NjozNS4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MTk1OTgxNjcsInJnbiI6ImV1YzEifQ.cnMohLLf-3OLr8YB2D968aHsquGA4Xo_ga3Ofw4zIao"
        },
        body: JSON.stringify({ query })
    })
    .then(resp => resp.json())
    .then(result => {
        const items = result.data.boards[0].items.slice(0, 10);
        const tbody = document.getElementById("userTableBody");
        tbody.innerHTML = "";
        for (let i = 0; i < 10; i++) {
            if (i < items.length) {
                let username = "", mail = "", pass = "", role = "", status = "";
                items[i].column_values.forEach(col => {
                    if (col.id === "texte_mkmxvc5j") username = col.text;
                    if (col.id === "texte_mkmznxcs") mail = col.text;
                    if (col.id === "texte_mkmxdczk") pass = col.text;
                    if (col.id === "texte_new_role") role = col.text;
                    if (col.id === "texte_new_status") status = col.text;
                });
                tbody.innerHTML += `<tr>
                    <td>${items[i].id}</td>
                    <td>${username}</td>
                    <td>${mail}</td>
                    <td>${pass}</td>
                    <td>${role}</td>
                    <td>${status}</td>
                </tr>`;
            } else {
                tbody.innerHTML += `<tr>
                    <td>No Data</td>
                    <td>No Data</td>
                    <td>No Data</td>
                    <td>No Data</td>
                    <td>No Data</td>
                    <td>No Data</td>
                </tr>`;
            }
        }
    })
    .catch(error => console.error("Error fetching monday.com board data:", error));
}

// To revert, run:
// git checkout <commit_hash> -- /c:/Users/Dreamex Lab/Website/script.js
