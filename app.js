// --- FIREBASE CONFIG (Kept exactly as provided) ---
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

// --- STATE MANAGEMENT ---
let allPlayers = []; 
let isDoublesMode = false;
let lockedDivisions = [];
let currentBracket = null;

// --- INITIALIZATION ---
function init() {
    refreshRosterFromDB();
    setupListeners();
    updateUIForMode();
}

// --- DATABASE SYNC ---
function refreshRosterFromDB() {
    db.ref('players').on('value', (snapshot) => {
        allPlayers = Object.values(snapshot.val() || {});
        renderRoster();
        const status = document.getElementById('connection-status');
        if (status) status.innerText = "Realtime Connected ✅";
    });
}

// --- 2 & 3: DYNAMIC LABELS ---
function updateUIForMode() {
    const draftHeader = document.getElementById('draft-header');
    const lockBtn = document.getElementById('btn-lock');
    
    // Point 1: Change "Lock Division" to "Division"
    if (lockBtn) lockBtn.innerText = "Division";
    
    // Point 3: Toggle "Selected Players" vs "Teams"
    if (draftHeader) {
        draftHeader.innerText = isDoublesMode ? "Teams" : "Selected Players";
    }
    renderRoster();
}

// --- ROSTER LOGIC ---
function renderRoster() {
    const list = document.getElementById('player-list');
    const search = document.getElementById('player-search').value.toLowerCase();
    if (!list) return;

    list.innerHTML = '';
    
    let filtered = allPlayers.filter(p => p.active && p.name.toLowerCase().includes(search));
    
    filtered.sort((a, b) => {
        const ratingA = isDoublesMode ? (a.doubles || 1000) : (a.singles || 1000);
        const ratingB = isDoublesMode ? (b.doubles || 1000) : (b.singles || 1000);
        return ratingB - ratingA;
    });

    filtered.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.style = "cursor:pointer; padding:8px; border-bottom:1px solid #333; display:flex; justify-content:space-between;";
        const rating = Math.round(isDoublesMode ? (player.doubles || 1000) : (player.singles || 1000));
        div.innerHTML = `<span>${player.name}</span> <span style="color:#3498db;">${rating}</span>`;
        div.onclick = () => addToDraft(player);
        list.appendChild(div);
    });
}

function addToDraft(player) {
    const area = document.getElementById('team-draft-area');
    const div = document.createElement('div');
    div.className = 'draft-entry';
    div.dataset.name = player.name;
    div.dataset.elo = isDoublesMode ? (player.doubles || 1000) : (player.singles || 1000);
    div.style = "background:#222; margin-bottom:5px; padding:10px; border-radius:4px; display:flex; justify-content:space-between;";
    div.innerHTML = `<span>${player.name}</span> <span onclick="this.parentElement.remove()" style="color:red; cursor:pointer;">X</span>`;
    area.appendChild(div);
}

// --- 4: UNLOCK LOGIC ---
document.getElementById('btn-lock').addEventListener('click', () => {
    const entries = document.querySelectorAll('.draft-entry');
    if (entries.length < 2) return alert("Select at least 2 participants.");

    const divName = document.getElementById('division-name').value;
    const format = document.getElementById('tourney-type').value;
    
    const participants = Array.from(entries).map(e => ({ name: e.dataset.name, elo: parseInt(e.dataset.elo) }));
    const id = Date.now();

    lockedDivisions.push({ id, name: divName, format, participants });
    renderLockedLog();
    document.getElementById('team-draft-area').innerHTML = '';
});

function renderLockedLog() {
    const log = document.getElementById('locked-log');
    log.innerHTML = '';
    lockedDivisions.forEach((div, index) => {
        const item = document.createElement('div');
        item.style = "background:#333; padding:8px; margin-bottom:5px; border-radius:4px; display:flex; justify-content:space-between; align-items:center;";
        item.innerHTML = `
            <span>✅ ${div.name} (${div.participants.length})</span>
            <button onclick="unlockDivision(${index})" style="background:#555; border:none; color:white; padding:2px 8px; cursor:pointer; font-size:11px;">Unlock</button>
        `;
        log.appendChild(item);
    });
}

window.unlockDivision = (index) => {
    const div = lockedDivisions[index];
    const area = document.getElementById('team-draft-area');
    
    // Repopulate draft area
    div.participants.forEach(p => addToDraft({ name: p.name, singles: p.elo, doubles: p.elo }));
    
    lockedDivisions.splice(index, 1);
    renderLockedLog();
};

// --- 5, 6, 7 & 8: BRACKET & SCORING ---
document.getElementById('btn-launch').addEventListener('click', () => {
    if (lockedDivisions.length === 0) return alert("Lock a division first.");
    const div = lockedDivisions[0];
    
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('tournament-view').style.display = 'block';
    document.getElementById('view-title').innerText = div.name;

    if (div.format === 'single_elim') {
        initBracket(div.participants);
    }
});

function initBracket(participants) {
    const sorted = [...participants].sort((a, b) => b.elo - a.elo);
    const round1 = [];
    while (sorted.length > 1) {
        round1.push({ p1: sorted.shift(), p2: sorted.pop(), winner: null });
    }
    if (sorted.length === 1) round1.push({ p1: sorted.shift(), p2: { name: "BYE" }, winner: 'p1', scoreText: "BYE" });

    currentBracket = [round1];
    renderBracket();
}

function renderBracket() {
    const container = document.getElementById('bracket-view');
    container.innerHTML = '<div style="display:flex; gap:30px; padding:20px; overflow-x:auto;"></div>';
    const wrapper = container.firstChild;

    currentBracket.forEach((round, rIdx) => {
        const col = document.createElement('div');
        col.style = "min-width:220px; display:flex; flex-direction:column; justify-content:space-around;";
        col.innerHTML = `<h4 style="color:#f1c40f; text-align:center;">Round ${rIdx + 1}</h4>`;

        round.forEach((match, mIdx) => {
            const card = document.createElement('div');
            card.style = "background:#1e1e1e; border:1px solid #444; padding:10px; margin:15px 0; border-radius:4px;";
            
            // Point 8: Name colors for winner/loser
            const p1Color = match.winner === 'p1' ? '#2ecc71' : (match.winner === 'p2' ? '#e74c3c' : '#fff');
            const p2Color = match.winner === 'p2' ? '#2ecc71' : (match.winner === 'p1' ? '#e74c3c' : '#fff');

            card.innerHTML = `
                <div style="color:${p1Color}; font-weight:bold; display:flex; justify-content:space-between;">
                    <span>${match.p1.name}</span> <span>${match.p1Games || ''}</span>
                </div>
                <div style="font-size:10px; text-align:center; color:#555; margin:5px 0;">vs</div>
                <div style="color:${p2Color}; font-weight:bold; display:flex; justify-content:space-between;">
                    <span>${match.p2.name}</span> <span>${match.p2Games || ''}</span>
                </div>
                ${match.winner ? `<div style="font-size:9px; color:#888; margin-top:5px;">${match.scoreText}</div>` : ''}
                ${!match.winner ? `<button onclick="enterScores(${rIdx}, ${mIdx})" style="width:100%; margin-top:10px; cursor:pointer;">Enter Scores</button>` : ''}
            `;
            col.appendChild(card);
        });
        wrapper.appendChild(col);
    });
}

// Point 7: Individual Game Scores (21-15, etc.)
window.enterScores = (rIdx, mIdx) => {
    const match = currentBracket[rIdx][mIdx];
    const input = prompt(`Enter scores for ${match.p1.name} vs ${match.p2.name}\nExample: 21-15, 18-21, 11-7`);
    
    if (!input) return;

    const sets = input.split(',').map(s => s.trim().split('-').map(Number));
    let p1Wins = 0, p2Wins = 0;

    sets.forEach(set => {
        if (set[0] > set[1]) p1Wins++;
        else if (set[1] > set[0]) p2Wins++;
    });

    match.p1Games = p1Wins;
    match.p2Games = p2Wins;
    match.winner = p1Wins > p2Wins ? 'p1' : 'p2';
    match.scoreText = input;

    // Point 6: Auto-progress to next round
    progressTournament(rIdx, mIdx);
    renderBracket();
};

function progressTournament(rIdx, mIdx) {
    const winner = currentBracket[rIdx][mIdx][currentBracket[rIdx][mIdx].winner];
    const nextR = rIdx + 1;
    const nextM = Math.floor(mIdx / 2);

    if (!currentBracket[nextR]) {
        const nextRoundSize = Math.ceil(currentBracket[rIdx].length / 2);
        if (nextRoundSize < 1) return;
        currentBracket[nextR] = Array.from({ length: nextRoundSize }, () => ({ p1: { name: "TBD" }, p2: { name: "TBD" } }));
    }

    if (mIdx % 2 === 0) currentBracket[nextR][nextM].p1 = winner;
    else currentBracket[nextR][nextM].p2 = winner;
}

// --- LISTENERS ---
function setupListeners() {
    document.getElementById('btn-mode-singles').onclick = () => { isDoublesMode = false; updateUIForMode(); };
    document.getElementById('btn-mode-doubles').onclick = () => { isDoublesMode = true; updateUIForMode(); };
    document.getElementById('player-search').oninput = renderRoster;
}

init();
