const globalVariables = require('../utils/global_variables.js');
const KurentoSessionManager = require('../KurentoManager/KurentoSessionManage.js');

const kurentoSessionManager = new KurentoSessionManager(globalVariables.ws_uri);

function StartHost(sessionId, socket, sdpOffer, callback) {
    clearCandidatesQueue(sessionId);
    if (stHost[socket.sessionId] !== null && stHost[socket.sessionId] !== undefined) {
        // If there is already a host for session (socket.sessionId)
        stop(sessionId, sessionId);
        return callback('Another user is already acting as a host, try again later...');
    }
    // Creating new entry for host
    stHost[socket.sessionId] = {
        id: sessionId,
        pipeline: null, // Media pipeline will be created later
        webRtcEndpoint: null
    };
    socket.webRtcEndpoint = null;

    kurentoSessionManager.SettingHostSession(sessionId, socket, sdpOffer, (error, sdpAnswer) => {
        if (error) {
            console.error('Error setting host session:', error);
            return callback(error);
        }
        console.log('Host session set successfully');
        callback(null, sdpAnswer);
    });
}

module.exports = { StartHost };