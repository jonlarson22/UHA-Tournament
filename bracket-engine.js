export class TournamentEngine {
    constructor(db) {
        this.db = db;
        this.currentTournament = null;
    }

    generateSeeding(participants, isDoubles) {
        return participants.sort((a, b) => b.elo - a.elo).map((p, index) => ({
            id: p.id,
            name: p.name,
            seed: index + 1
        }));
    }

    calculateMatchPoints(scoreA, scoreB) {

        let results = { pointsA: 0, pointsB: 0 };


        if (scoreA > scoreB) {
            results.pointsA = 2;
            results.pointsB = (scoreB === 1) ? 1 : 0;
        } else {
            results.pointsB = 2;
            results.pointsA = (scoreA === 1) ? 1 : 0;
        }
        return results;
    }

    async createRoundRobin(name, participants) {
        const seeding = this.generateSeeding(participants);
        
        const stage = {
            name: name,
            type: 'round_robin',
            settings: { groupCount: Math.ceil(participants.length / 4) },
            participants: seeding
        };

        console.log("Stage Created:", stage);
        return stage;
    }

    promoteToBrackets(standings) {
        const championshipSeeds = [];
        const consolationSeeds = [];

        standings.forEach(group => {
            group.forEach((team, rank) => {
                if (rank < 2) {
                    championshipSeeds.push(team);
                } else {
                    consolationSeeds.push(team);
                }
            });
        });

        return { championshipSeeds, consolationSeeds };
    }
}
