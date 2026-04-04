// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyCCV_WHA1Q7WKawfG68Y9z40xINVg5zbmw",
    authDomain: "utah-handball.firebaseapp.com",
    databaseURL: "https://utah-handball-default-rtdb.firebaseio.com",
    projectId: "utah-handball",
    storageBucket: "utah-handball.firebasestorage.app",
    messagingSenderId: "4109545863",
    appId: "1:4109545863:web:6a6de7f532be0bc20f2322"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- STATE ---
let allPlayers = [];
let selectedPlayers = [];
let isDoublesMode = false;

// --- HELPERS ---
const el = (id) => document.getElementById(id);

// --- INITIALIZE & SYNC ---
function init() {
    // Listen for data changes
    db.ref('players').on('value', (snapshot) => {
        allPlayers = Object.values(snapshot.val() || {});
        renderRoster();
        if (el('connection-status')) {
            el('connection-status').innerText = "Realtime Connected ✅";
            el('connection-status').style.color = "#4CAF50";
        }
    });

    setupListeners();
}

function renderRoster() {
    const list = el('player-list');
    const search = el('player-search')?.value.toLowerCase() || "";
    if (!list) return;

    list.innerHTML = "";
    
    // Filter and Sort players from the database
    const filtered = allPlayers.filter(p => p.active && p.name.toLowerCase().includes(search));
    
    filtered.sort((a, b) => {
        const scoreA = isDoublesMode ? (a.doubles || 1000) : (a.singles || 1000);
        const scoreB = isDoublesMode ? (b.doubles || 1000) : (b.singles || 1000);
        return scoreB - scoreA;
    });

    filtered.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        const score = Math.round(isDoublesMode ? (player.doubles || 1000) : (player.singles || 1000));
        div.innerHTML = `<span>${player.name}</span> <strong>${score}</strong>`;
        div.onclick = () => selectPlayer(player);
        list.appendChild(div);
    });
}

function selectPlayer(player) {
    if (selectedPlayers.find(p => p.id === player.id)) return;
    selectedPlayers.push(player);
    renderSelected();
}

function renderSelected() {
    const area = el('team-draft-area');
    if (!area) return;
    area.innerHTML = "";
    selectedPlayers.forEach((p, index) => {
        const div = document.createElement('div');
        div.className = 'selected-player';
        div.innerHTML = `${p.name} <span style="color:red; cursor:pointer;" onclick="removePlayer(${index})">✖</span>`;
        area.appendChild(div);
    });
    if (el('draft-header')) el('draft-header').innerText = `Selected (${selectedPlayers.length})`;
}

window.removePlayer = (index) => {
    selectedPlayers.splice(index, 1);
    renderSelected();
};

// --- EVENT LISTENERS ---
function setupListeners() {
    el('player-search')?.addEventListener('input', renderRoster);

    el('btn-mode-singles')?.addEventListener('click', () => {
        isDoublesMode = false;
        el('btn-mode-singles').className = "uha-btn btn-primary";
        el('btn-mode-doubles').className = "uha-btn btn-dark";
        renderRoster();
    });

    el('btn-mode-doubles')?.addEventListener('click', () => {
        isDoublesMode = true;
        el('btn-mode-doubles').className = "uha-btn btn-primary";
        el('btn-mode-singles').className = "uha-btn btn-dark";
        renderRoster();
    });

    el('btn-lock')?.addEventListener('click', () => {
        const log = el('locked-log');
        const divName = el('division-name').value;
        if (log) log.innerHTML += `<div>✅ ${divName} Locked with ${selectedPlayers.length} players.</div>`;
    });

    el('btn-launch')?.addEventListener('click', () => {
        el('admin-dashboard').style.display = 'none';
        el('tournament-view').style.display = 'block';
        el('view-title').innerText = el('division-name').value + " - Preview";
        // Here you would trigger your bracket-engine or round-robin logic
    });
}

init();
