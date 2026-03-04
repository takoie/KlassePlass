// =========================================================
// CLASS LOGIC MODULE
// =========================================================
const { ipcRenderer } = require('electron');

let studentList = [];
let editingId = null;

// Dependencies injected from main renderer
let deps = {};

function init(dependencies) {
    deps = dependencies;
}

async function loadClasses() {
    const classes = await ipcRenderer.invoke('get-classes');
    const grid = document.getElementById('classGrid'); grid.innerHTML = '';
    classes.forEach(c => {
        const count = c.students ? c.students.split('\n').filter(s => s.trim()).length : 0;
        grid.innerHTML += `
            <div class="info-card" onclick="editClass(${c.id})">
                <h5 class="card-title-large">${c.name}</h5>
                <span class="card-info-text">${count} Elever</span>
                <button class="btn-action btn-danger btn-sm-action" style="position:absolute; bottom:15px; right:15px;" 
                onclick="event.stopPropagation(); openDeleteModal(() => deleteClass(${c.id}))">Slett</button>
            </div>`;
    });
}

function parseStudentsFromText(text) {
    if (!text || !text.trim()) return [];
    const raw = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split(/[\n\t,;|]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    return [...new Set(raw)];
}

function renderStudentList() {
    const container = document.getElementById('studentListItems');
    if (!container) return;
    container.innerHTML = studentList.map((name, i) => `
        <div class="student-card">
            <span class="student-card-num">${i + 1}</span>
            <span class="student-card-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
            <button type="button" class="student-card-remove" onclick="removeStudent(${i})" title="Fjern elev">×</button>
        </div>
    `).join('');
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function addStudentsFromPaste() {
    const input = document.getElementById('studentPasteInput');
    if (!input) return;
    const parsed = parseStudentsFromText(input.value);
    if (parsed.length === 0) {
        deps.showToast('Ingen navn funnet – sjekk format (tab, komma, semikolon eller linjeskift)');
        return;
    }
    studentList = [...studentList, ...parsed];
    input.value = '';
    renderStudentList();
    deps.showToast(`${parsed.length} elev(er) lagt til`);
}

function removeStudent(index) {
    studentList.splice(index, 1);
    renderStudentList();
}

function openClassCreate() {
    editingId = null;
    studentList = [];
    document.getElementById('classIdInput').value = '';
    document.getElementById('classNameInput').value = '';
    const pasteInput = document.getElementById('studentPasteInput');
    if (pasteInput) pasteInput.value = '';
    document.getElementById('classEditorTitle').innerText = "Opprett gruppe";
    document.getElementById('btnClassDelete').style.display = 'none';
    renderStudentList();
}

async function editClass(id) {
    editingId = id;
    const c = await ipcRenderer.invoke('get-class', id);
    document.getElementById('classIdInput').value = c.id;
    document.getElementById('classEditorTitle').innerText = "Rediger: " + c.name;
    document.getElementById('classNameInput').value = c.name;
    studentList = parseStudentsFromText(c.students || '');
    const pasteInput = document.getElementById('studentPasteInput');
    if (pasteInput) pasteInput.value = '';
    document.getElementById('btnClassDelete').style.display = 'block';
    renderStudentList();
    deps.navTo('view-group-editor');
}

async function saveClass() {
    const name = document.getElementById('classNameInput').value;
    if (!name) return deps.showToast("Mangler navn");
    const students = studentList.join('\n');
    await ipcRenderer.invoke('save-class', editingId, name, students);
    deps.showToast("Lagret"); deps.navTo('view-groups');
}

async function deleteClass(id) {
    await ipcRenderer.invoke('delete-class', id || editingId);
    deps.showToast("Slettet"); deps.navTo('view-groups');
}

// Getters for shared state
function getStudentList() { return studentList; }
function setStudentList(list) { studentList = list; }
function getEditingId() { return editingId; }
function setEditingId(id) { editingId = id; }

module.exports = {
    init,
    loadClasses,
    parseStudentsFromText,
    renderStudentList,
    escapeHtml,
    addStudentsFromPaste,
    removeStudent,
    openClassCreate,
    editClass,
    saveClass,
    deleteClass,
    getStudentList,
    setStudentList,
    getEditingId,
    setEditingId
};
