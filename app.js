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

let allPlayers = []; 
let isDoublesMode = true;

const teamDraftArea = document.getElementById('team-draft-area');
const playerListDiv = document.getElementById('player-list');

document.getElementById('btn-mode-singles').addEventListener('click', (e) => {
    isDoublesMode = false;
    e.target.classList.add('active');
    document.getElementById('btn-mode-doubles').classList.remove('active');
    document.getElementById('add-team-btn').style.display = 'none';
    teamDraftArea.innerHTML = '';
    renderRoster();
});

document.getElementById('btn-mode-doubles').addEventListener('click', (e) => {
    isDoublesMode = true;
    e.target.classList.add('active');
    document.getElementById('btn-mode-singles').classList.remove('active');
    document.getElementById('add-team-btn').style.display = 'block';
    teamDraftArea.innerHTML = '';
    renderRoster();
});

function refreshRosterFromDB() {
    db.ref('players').once('value', (snapshot) => {
        allPlayers = snapshot.val() || [];
        renderRoster();
        document.getElementById('connection-status').innerText = "Realtime Connected ✅";
    });
}

function getDraftedPlayerIds() {
    const draftedElements = Array.from(teamDraftArea.querySelectorAll('.player-item'));
    return draftedElements.map(p => p.dataset.id);
}

function renderRoster() {
    playerListDiv.innerHTML = '';
    const draftedIds = getDraftedPlayerIds();
    
    let availablePlayers = allPlayers.filter(p => p.active && !draftedIds.includes(String(p.id)));
    
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
        
        div.innerHTML = `<span>${player.name}</span> <span style="color:var(--uha-blue)">${Math.round(div.dataset.elo)}</span>`;
        playerListDiv.appendChild(div);
    });
}

function createTeamSlot(playerItemElement = null) {
    const teamId = Date.now();
    const teamDiv = document.createElement('div');
    teamDiv.className = 'team-slot';
    teamDiv.innerHTML = `
        <div class="team-header">
            <span>Team <span class="team-elo">0</span> ELO</span>
            <button class="remove-team-btn">X</button>
        </div>
        <div class="slots" data-team-id="${teamId}"></div>
    `;
    teamDraftArea.appendChild(teamDiv);

    if (playerItemElement) {
        teamDiv.querySelector('.slots').appendChild(playerItemElement);
        updateTeamElo(teamDiv);
    }
}

document.getElementById('add-team-btn').addEventListener('click', () => createTeamSlot());

playerListDiv.addEventListener('click', (e) => {
    const playerItem = e.target.closest('.player-item');
    if (!playerItem) return;

    if (!isDoublesMode) {
        createTeamSlot(playerItem);
        renderRoster();
    } else {
        const openSlot = document.querySelector('.team-slot:last-child .slots');
        if (openSlot && openSlot.children.length < 2) {
            openSlot.appendChild(playerItem);
            updateTeamElo(openSlot.closest('.team-slot'));
            renderRoster();
        } else {
            alert("Click '+ Add Empty Team Slot' first!");
        }
    }
});

teamDraftArea.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-team-btn')) {
        const teamSlot = e.target.closest('.team-slot');
        teamSlot.remove();
        renderRoster();
    }
});

function updateTeamElo(teamDiv) {
    const players = teamDiv.querySelectorAll('.player-item');
    let totalElo = 0;
    players.forEach(p => totalElo += parseFloat(p.dataset.elo));
    const avgElo = players.length > 0 ? Math.round(totalElo / players.length) : 0;
    teamDiv.querySelector('.team-elo').innerText = avgElo;
    teamDiv.dataset.finalElo = avgElo;
}

const engine = new TournamentEngine(db);

document.getElementById('btn-start').addEventListener('click', async () => {
    const teamElements = document.querySelectorAll('.team-slot');
    const participants = Array.from(teamElements).map(t => ({
        name: Array.from(t.querySelectorAll('.player-item')).map(p => p.dataset.name).join(' / '),
        elo: parseInt(t.dataset.finalElo)
    }));

    if (participants.length < 2) return alert("You need at least 2 participants!");

    const tourneyData = await engine.createRoundRobin("Qualifying Groups", participants);
    
    document.getElementById('setup-container').style.display = 'none';
    document.getElementById('tournament-view').style.display = 'block';

    window.bracketsViewer.render({
        stages: [tourneyData.stage],
        matches: tourneyData.matches,
        participants: tourneyData.participants
    });
});

refreshRosterFromDB();
