const globals = {
    // Existing variables
    stIdCounter: 0,
    stCandidatesQueue: {},
    stKurentoClient: null,
    stNoHostMessage: 'No active presenter. Try again later...',
    presenter: {},
    viewers: {},
    waitingViewers: {},
    stOptions: {
        ws_uri: 'ws://127.0.0.1:8888/kurento'
    },

    // New viewer state variables
    viewerState: {
        autoPlay: false,
        presenterStatus: 'offline',
        isSharing: false,
        isWaitingViewer: true,
        isConnected: false,
        streamMechanism: 'peer',
        player: null,
        played: false,
        nodePort: '3000'
    },

    // Add methods to update viewer state
    updateViewerState(updates) {
        Object.assign(this.viewerState, updates);
    },

    resetViewerState() {
        this.viewerState = {
            autoPlay: false,
            presenterStatus: 'offline',
            isSharing: false,
            isWaitingViewer: true,
            isConnected: false,
            streamMechanism: 'peer',
            player: null,
            played: false,
            nodePort: '3000'
        };
    }
};

module.exports = globals;
