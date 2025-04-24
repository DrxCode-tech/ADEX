// ADEX.js
import { db } from "./fireConfig.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

// --- DOM references ---
const presentBut     = document.querySelector('.present');
const absentBut      = document.querySelector('.absent');
const attendanceBut  = document.querySelector('.get-attendance-btn');
const displayPage    = document.querySelector('.adexDispy');
const courseSelect   = document.querySelector('.input-field');
const dateInput      = document.getElementById('date-input');

let currentTableHTML = '';  // for print/download

window.addEventListener('DOMContentLoaded', () => {
  const toogle = document.querySelector('.togBut');
  const titlePage = document.querySelector('.title');
  let state = true;

  toogle.addEventListener('click', () => {
    if (state) {
      titlePage.style.height = '80px';
      toogle.innerHTML = '🔽';
    } else {
      titlePage.style.height = '150px';
      toogle.innerHTML = '🔼';
    }
    state = !state;
  });
});


// --- Fetch and merge attendance + user list ---
async function fetchAttendance(courseName, selectedDate) {
  const attCol = collection(db, `${courseName}_${selectedDate}`);
  const usrCol = collection(db, "users");

  const [attSnap, usrSnap] = await Promise.all([
    getDocs(attCol),
    getDocs(usrCol)
  ]);

  // Map of regNumber → timestamp
  const presentMap = new Map();
  attSnap.forEach(doc => {
    const d = doc.data();
    presentMap.set(d.regNumber, d.timestamp);
  });

  // Build merged list:
  const merged = [];
  usrSnap.forEach(doc => {
    const u = doc.data();
    merged.push({
      name: u.name,
      regNumber: u.regNumber,
      status: presentMap.has(u.regNumber) ? "Present" : "Absent",
      timestamp: presentMap.get(u.regNumber) || null
    });
  });

  return merged;
}

// --- Build an HTML table from records ---
function buildTable(records, showStatus = true, showTime = true) {
  let html = `<table style="width:100%;border-collapse:collapse;margin-top:10px">
    <thead style="background:#1f5c1c;color:white">
      <tr>
        <th style="padding:8px;border:1px solid #ccc">Name</th>
        <th style="padding:8px;border:1px solid #ccc">Reg No.</th>`;
  if (showStatus) html += `<th style="padding:8px;border:1px solid #ccc">Status</th>`;
  if (showTime)   html += `<th style="padding:8px;border:1px solid #ccc">Timestamp</th>`;
  html += `</tr></thead><tbody>`;

  records.forEach(r => {
    html += `<tr>
      <td style="padding:8px;border:1px solid #ccc">${r.name}</td>
      <td style="padding:8px;border:1px solid #ccc">${r.regNumber}</td>`;
    if (showStatus) {
      html += `<td style="padding:8px;border:1px solid #ccc">${r.status}</td>`;
    }
    if (showTime) {
      const txt = r.timestamp
        ? new Date(r.timestamp.seconds * 1000).toLocaleString()
        : "-";
      html += `<td style="padding:8px;border:1px solid #ccc">${txt}</td>`;
    }
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

// --- Core view logic ---
async function renderView(filterStatus = null) {
  displayPage.innerHTML = "";
  const courseName = courseSelect.value.trim();
  const dateVal    = dateInput.value;
  if (!courseName || !dateVal) {
    return alert("Please select both course and date.");
  }

  // Format YYYY‑MM‑DD to DD‑MM‑YYYY
  const [yy, mm, dd] = dateVal.split("-");
  const formattedDate = `${dd}-${mm}-${yy}`;

  try {
    const allRecs = await fetchAttendance(courseName, formattedDate);
    // filter if needed
    const viewRecs = filterStatus
      ? allRecs.filter(r => r.status === filterStatus)
      : allRecs;

    if (viewRecs.length === 0) {
      displayPage.textContent = filterStatus
        ? `No ${filterStatus.toLowerCase()} students.`
        : "No records found.";
    } else {
      // decide which columns: status/time for full; only time for present/absent
      const showStatus = !filterStatus;  
      const showTime   = true;
      currentTableHTML = buildTable(viewRecs, showStatus, showTime);
      displayPage.innerHTML = currentTableHTML;
    }
  } catch (err) {
    console.error(err);
    alert("Error loading attendance: " + err.message);
  }
}

// --- Button wiring ---
attendanceBut.addEventListener('click', () => renderView(null));         // full
presentBut   .addEventListener('click', () => renderView("Present"));   // only present
absentBut    .addEventListener('click', () => renderView("Absent"));    // only absent

// --- Print & Download (reuse currentTableHTML) ---
window.printAttendance = function () {
  if (!currentTableHTML) return alert("No table to print!");
  const w = window.open("", "_blank");
  w.document.write(`<html><body>${currentTableHTML}</body></html>`);
  w.document.close();
  w.print();
};

window.downloadAttendance = function () {
  if (!currentTableHTML) return alert("No data to download!");
  const blob = new Blob([currentTableHTML], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "attendance.html";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
