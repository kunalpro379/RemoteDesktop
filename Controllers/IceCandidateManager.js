class IceCandidateManager {
    constructor() {
        this.candidatesQueue = {};
    }

    addCandidate(sessionId, candidate) {
        if (!this.candidatesQueue[sessionId]) {
            this.candidatesQueue[sessionId] = [];
        }
        this.candidatesQueue[sessionId].push(candidate);
    }

    clearCandidates(sessionId) {
        delete this.candidatesQueue[sessionId];
    }

    getCandidates(sessionId) {
        return this.candidatesQueue[sessionId] || [];
    }
}

module.exports = IceCandidateManager;
