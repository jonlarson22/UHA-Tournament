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

// --- STATE MANAGEMENT ---
let allPlayers = []; 
let isDoublesMode = false;
let isAdmin = true;
let lockedDivisions = [];

// Ensure panels display correctly based on Admin state
function updateVisibility() {
    const resetBtn = document.getElementById('btn-reset');
    
    if (isAdmin) {
        document.getElementById('admin-dashboard').style.display = 'block';
        document.getElementById('public-viewer').style.display = 'none';
        if(resetBtn) resetBtn.style.display = 'block'; 
    } else {
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('public-viewer').style.display = 'block';
        if(resetBtn) resetBtn.style.display = 'none'; 
    }
}
updateVisibility();

const teamDraftArea = document.getElementById('team-draft-area');
const playerListDiv = document.getElementById('player-list');
const searchInput = document.getElementById('player-search');

// --- TOGGLES ---
document.getElementById('btn-mode-singles').addEventListener('click', (e) => {
    isDoublesMode = false;
    e.target.classList.add('active');
    document.getElementById('btn-mode-doubles').classList.remove('active');
    document.getElementById('draft-header').innerText = "Selected Players";
    teamDraftArea.innerHTML = ''; 
    renderRoster();
});

document.getElementById('btn-mode-doubles').addEventListener('click', (e) => {
    isDoublesMode = true;
    e.target.classList.add('active');
    document.getElementById('btn-mode-singles').classList.remove('active');
    document.getElementById('draft-header').innerText = "Teams";
    teamDraftArea.innerHTML = ''; 
    renderRoster();
});

// --- ROSTER LOGIC ---
function refreshRosterFromDB() {
    db.ref('players').once('value', (snapshot) => {
        allPlayers = snapshot.val() || [];
        renderRoster();
        const connStatus = document.getElementById('connection-status');
        if(connStatus) connStatus.innerText = "Realtime Connected ✅";
    });
}

searchInput.addEventListener('input', renderRoster);

function getDraftedPlayerIds() {
    const draftedElements = Array.from(teamDraftArea.querySelectorAll('.drafted-id'));
    return draftedElements.map(p => p.dataset.id);
}

function renderRoster() {
    playerListDiv.innerHTML = '';
    const draftedIds = getDraftedPlayerIds();
    const searchTerm = searchInput.value.toLowerCase();

    let availablePlayers = allPlayers.filter(p => 
        p.active && 
        !draftedIds.includes(String(p.id)) &&
        p.name.toLowerCase().includes(searchTerm)
    );
    
    availablePlayers.sort((a, b) => {
        const ratingA = isDoublesMode ? (a.doubles || 1000) : (a.singles || 1000);
        const ratingB = isDoublesMode ? (b.doubles || 1000) : (b.singles || 1000);
        return ratingB - ratingA;
    });

    availablePlayers.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.dataset.id = player.id;
        div.dataset.name = player.name;
        div.dataset.elo = isDoublesMode ? (player.doubles || 1000) : (player.singles || 1000);
        div.innerHTML = `<span>${player.name}</span> <span style="color:var(--uha-blue); font-weight:bold;">${Math.round(div.dataset.elo)}</span>`;
        playerListDiv.appendChild(div);
    });
}

// --- DRAFT LOGIC ---
playerListDiv.addEventListener('click', (e) => {
    const playerItem = e.target.closest('.player-item');
    if (!playerItem) return;

    if (!isDoublesMode) {
        const singlesDiv = document.createElement('div');
        singlesDiv.className = 'singles-slot';
        singlesDiv.dataset.finalName = playerItem.dataset.name;
        singlesDiv.dataset.finalElo = playerItem.dataset.elo;
        
        singlesDiv.innerHTML = `
            <div style="font-weight: bold;">
                ${playerItem.dataset.name} <span style="color:var(--uha-blue); margin-left:10px;">${Math.round(playerItem.dataset.elo)}</span>
            </div>
            <div class="drafted-id" data-id="${playerItem.dataset.id}" style="display:none;"></div>
            <button class="remove-team-btn">X</button>
        `;
        teamDraftArea.appendChild(singlesDiv);

    } else {
        let openSlot = document.querySelector('.team-slot:last-child .slots');

        if (!openSlot || openSlot.children.length >= 2) {
            const teamId = Date.now();
            const teamDiv = document.createElement('div');
            teamDiv.className = 'team-slot';
            teamDiv.innerHTML = `
                <div class="team-header">
                    <span>Team ELO: <span class="team-elo">0</span></span>
                    <button class="remove-team-btn">X</button>
                </div>
                <div class="slots" data-team-id="${teamId}"></div>
            `;
            teamDraftArea.appendChild(teamDiv);
            openSlot = teamDiv.querySelector('.slots');
        }

        const clone = document.createElement('div');
        clone.className = 'drafted-id player-item';
        clone.dataset.id = playerItem.dataset.id;
        clone.dataset.name = playerItem.dataset.name;
        clone.dataset.elo = playerItem.dataset.elo;
        clone.innerHTML = playerItem.innerHTML;
        clone.style.marginBottom = "5px";
        
        openSlot.appendChild(clone);
        updateTeamElo(openSlot.closest('.team-slot'));
    }
    renderRoster();
});

teamDraftArea.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-team-btn')) {
        const slot = e.target.closest('.singles-slot') || e.target.closest('.team-slot');
        slot.remove();
        renderRoster(); 
    }
});

function updateTeamElo(teamDiv) {
    const players = teamDiv.querySelectorAll('.drafted-id');
    let totalElo = 0;
    let names = [];
    players.forEach(p => {
        totalElo += parseFloat(p.dataset.elo);
        names.push(p.dataset.name);
    });
    const avgElo = players.length > 0 ? Math.round(totalElo / players.length) : 0;
    teamDiv.querySelector('.team-elo').innerText = avgElo;
    
    teamDiv.dataset.finalName = names.join(' & ');
    teamDiv.dataset.finalElo = avgElo;
}

// --- WILDCARD LOGIC ---
document.getElementById('btn-add-wildcard').addEventListener('click', () => {
    const nameStr = document.getElementById('wildcard-name').value;
    const eloVal = document.getElementById('wildcard-elo').value;
    
    if (!nameStr) return alert("Enter a wildcard name");

    const fakePlayerItem = document.createElement('div');
    fakePlayerItem.className = 'player-item';
    fakePlayerItem.dataset.id = 'wildcard_' + Date.now();
    fakePlayerItem.dataset.name = nameStr + " (WC)";
    fakePlayerItem.dataset.elo = eloVal || 1000;

    playerListDiv.appendChild(fakePlayerItem);
    fakePlayerItem.click(); 

    document.getElementById('wildcard-name').value = '';
});

// --- LOCKING LOGIC ---
document.getElementById('btn-lock-division').addEventListener('click', () => {
    const divName = document.getElementById('division-name').value;
    const format = document.getElementById('tourney-type').value;
    
    const participantElements = document.querySelectorAll('.singles-slot, .team-slot');
    if (participantElements.length < 2) return alert("Need at least 2 participants to lock a division.");

    const participants = Array.from(participantElements).map(el => ({
        name: el.dataset.finalName,
        elo: parseInt(el.dataset.finalElo)
    }));

    lockedDivisions.push({
        name: divName,
        format: format,
        mode: isDoublesMode ? "Doubles" : "Singles",
        participants: participants,
        bracket: [] 
    });

    renderLockedDivisions();
    document.getElementById('team-draft-area').innerHTML = '';
    renderRoster();
});

function renderLockedDivisions() {
    const divLog = document.getElementById('locked-divisions-list');
    divLog.innerHTML = '';
    lockedDivisions.forEach((div, index) => {
        divLog.innerHTML += `
            <div style="background: rgba(52, 152, 219, 0.1); padding: 8px; border-radius: 4px; margin-bottom: 5px; border-left: 3px solid var(--uha-blue);">
                ✅ Locked: <b>${div.name} (${div.mode})</b> - ${div.participants.length} entries
                <button class="unlock-btn" onclick="unlockDivision(${index})">Unlock</button>
            </div>
        `;
    });
}

window.unlockDivision = function(index) {
    const divToUnlock = lockedDivisions.splice(index, 1)[0];
    divToUnlock.participants.forEach(p => {
        const slot = document.createElement('div');
        slot.className = 'singles-slot'; 
        slot.dataset.finalName = p.name;
        slot.dataset.finalElo = p.elo;
        slot.innerHTML = `
            <div style="font-weight: bold;">
                ${p.name} <span style="color:var(--uha-blue); margin-left:10px;">${Math.round(p.elo)}</span>
            </div>
            <button class="remove-team-btn">X</button>
        `;
        teamDraftArea.appendChild(slot);
    });
    renderLockedDivisions();
};

// --- TOURNAMENT PREVIEW & BRACKET PROGRESSION LOGIC ---
document.getElementById('btn-start').addEventListener('click', () => {
    if (lockedDivisions.length === 0) {
        document.getElementById('btn-lock-division').click();
    }
    if (lockedDivisions.length === 0) return; 

    lockedDivisions.forEach(division => {
        if (division.format === 'single_elim' && division.bracket.length === 0) {
            let p = [...division.participants];
            let nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(p.length || 1)));
            if(nextPowerOf2 < 2) nextPowerOf2 = 2;
            let numByes = nextPowerOf2 - p.length;

            let round1 = [];
            let totalMatches = nextPowerOf2 / 2;

            for(let i=0; i < totalMatches; i++) {
                if (i < numByes) {
                    let p1 = p.shift();
                    round1.push({ p1: p1, p2: null, p1Wins: 0, p2Wins: 0, scores: 'BYE', winner: 'p1' });
                } else {
                    let p1 = p.shift();
                    let p2 = p.pop(); 
                    round1.push({ p1: p1, p2: p2, p1Wins: 0, p2Wins: 0, scores: '', winner: null });
                }
            }
            division.bracket = [round1];
        } 
        else if (division.format === 'round_robin' && division.bracket.length === 0) {
            let p = [...division.participants];
            let matches = [];
            for(let i=0; i<p.length; i++) {
                for(let j=i+1; j<p.length; j++) {
                    matches.push({ p1: p[i], p2: p[j], p1Wins: 0, p2Wins: 0, scores: '', winner: null });
                }
            }
            division.bracket = [matches]; 
        }
    });

    renderTournamentView();
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('tournament-view').style.display = 'block';
});

function renderTournamentView() {
    let html = '';
    lockedDivisions.forEach((div, divIdx) => {
        html += `<div class="section-title" style="margin-top: 30px;">${div.name} (${div.mode} - ${div.format === 'single_elim' ? 'Knockout' : 'Round Robin'})</div>`;
        
        if (div.format === 'single_elim') {
            html += `<div class="bracket-wrapper">`;
            div.bracket.forEach((round, rIdx) => {
                html += `<div class="bracket-round">`;
                html += `<div style="text-align:center; color:var(--uha-gold); font-weight:bold;">Round ${rIdx + 1}</div>`;
                
                round.forEach((match, mIdx) => {
                    html += generateMatchCardHTML(match, divIdx, rIdx, mIdx);
                });
                html += `</div>`;
            });
            html += `</div>`;
        } else if (div.format === 'round_robin') {
            html += `<div class="bracket-wrapper" style="flex-wrap: wrap;">`;
            div.bracket[0].forEach((match, mIdx) => {
                html += generateMatchCardHTML(match, divIdx, 0, mIdx);
            });
            html += `</div>`;
        }
    });
    document.getElementById('matchup-container').innerHTML = html;
}

function generateMatchCardHTML(match, divIdx, rIdx, mIdx) {
    const p1Class = match.winner === 'p1' ? 'text-win' : (match.winner === 'p2' ? 'text-lose' : '');
    const p2Class = match.winner === 'p2' ? 'text-win' : (match.winner === 'p1' ? 'text-lose' : '');
    
    return `
    <div class="match-card" style="min-width: 200px;">
        <div class="match-team ${p1Class}">${match.p1 ? match.p1.name : 'TBD'} <span>${match.scores ? match.p1Wins : ''}</span></div>
        <div class="match-vs">vs</div>
        <div class="match-team ${p2Class}">${match.p2 ? match.p2.name : (match.scores === 'BYE' ? '' : 'TBD')} <span>${match.scores ? match.p2Wins : ''}</span></div>
        ${match.scores ? `<div style="text-align:center; font-size:10px; color:#888; margin-top:5px;">${match.scores}</div>` : ''}
        ${!match.winner && match.p1 && match.p2 ? `<button class="uha-btn" style="margin-top:10px; font-size:11px; padding:6px;" onclick="enterScore(${divIdx}, ${rIdx}, ${mIdx})">Enter Score</button>` : ''}
    </div>`;
}

// --- SCORING & PROGRESSION ---
window.enterScore = function(divIdx, rIdx, mIdx) {
    const div = lockedDivisions[divIdx];
    const match = div.bracket[rIdx][mIdx];

    const scoreStr = prompt(`Enter game scores for ${match.p1.name} vs ${match.p2.name} (e.g., 21-15, 18-21, 11-7):`);
    if (!scoreStr) return;

    const games = scoreStr.split(',');
    let p1Wins = 0, p2Wins = 0;

    games.forEach(g => {
        const scores = g.trim().split('-');
        if (scores.length === 2) {
            const s1 = parseInt(scores[0]);
            const s2 = parseInt(scores[1]);
            if (s1 > s2) p1Wins++;
            else if (s2 > s1) p2Wins++;
        }
    });

    match.scores = scoreStr;
    match.p1Wins = p1Wins;
    match.p2Wins = p2Wins;

    if (p1Wins > p2Wins) match.winner = 'p1';
    else if (p2Wins > p1Wins) match.winner = 'p2';
    else return alert("Scores result in a tie. Please re-enter.");

    progressBracket(divIdx, rIdx, mIdx);
    renderTournamentView();
};

function progressBracket(divisionIndex, rIdx, mIdx) {
    let div = lockedDivisions[divisionIndex];
    if (div.format !== 'single_elim') return; 

    let match = div.bracket[rIdx][mIdx];
    let winner = match.winner === 'p1' ? match.p1 : match.p2;

    let nextRIdx = rIdx + 1;
    let nextMIdx = Math.floor(mIdx / 2);

    if (!div.bracket[nextRIdx]) {
        let numMatches = Math.ceil(div.bracket[rIdx].length / 2);
        if (numMatches === 0 || (numMatches === 1 && div.bracket[rIdx].length === 1)) return; 
        div.bracket[nextRIdx] = Array.from({length: numMatches}, () => ({p1: null, p2: null, p1Wins: 0, p2Wins: 0, scores: '', winner: null}));
    }

    if (mIdx % 2 === 0) div.bracket[nextRIdx][nextMIdx].p1 = winner;
    else div.bracket[nextRIdx][nextMIdx].p2 = winner;
}

// Initialize
refreshRosterFromDB();
