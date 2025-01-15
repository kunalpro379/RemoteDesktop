const globalVariables = {
    httpPort: 3096,
    kurentoIP: '127.0.0.1',
    kurentoPort: 8888,
    stIdCounter: 0,
    stCandidatesQueue: {},
    stKurentoClient: null,
    stHost: {},
    stController: {},
    stNoHostMessage: 'No active host found',
    Host: {},
    Controllers: {},
    waitingControllers: {},
    ws_uri: 'ws://127.0.0.1:8888/kurento',
    stOptions: {
        ws_uri: 'ws://127.0.0.1:8888/kurento'
    }
};

module.exports = globalVariables;
