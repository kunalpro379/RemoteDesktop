const globalVariables = require('./global_variables');

// Function to unregister a viewer

const unregisterController = (socket) => {
    Object.keys(socket.parents).forEach(parent => {
        if (globalVariables.Controllers[parent]) {
            delete globalVariables.Controllers[parent].childs[socket.id];
        }
    });
    if (globalVariables.Host && globalVariables.Host[socket.sessionId] && globalVariables.Host[socket.sessionId].parents[socket.id]) {
        delete globalVariables.Host[socket.sessionId].parents[socket.id];
    }

    Object.keys(socket.childs).forEach(child => {
        if (globalVariables.Controllers[child]) {
            delete globalVariables.Controllers[child].parents[socket.id];
        }
    });
    if (globalVariables.Host && globalVariables.Host[socket.sessionId] && globalVariables.Host[socket.sessionId].childs[socket.id]) {
        delete globalVariables.Host[socket.sessionId].childs[socket.id];
    }

    if (globalVariables.Host && globalVariables.Host[socket.sessionId]) {
        delete globalVariables.Host[socket.sessionId].controllers[socket.id];
    }
    delete globalVariables.Controllers[socket.id];

    if (socket.controllers) {
        Object.keys(socket.controllers).forEach(viewer => {
            try {
                if (!globalVariables.Controllers[viewer]) {
                    return;
                }
                globalVariables.Controllers[viewer].senderId = getSender(globalVariables.Controllers[viewer].sessionId, globalVariables.Controllers[viewer].id);
                globalVariables.Controllers[viewer].emit("senderDisconnected", { newSenderId: globalVariables.Controllers[viewer].senderId });
                let sender = globalVariables.Controllers[viewer].senderId != globalVariables.Host[socket.sessionId].id ? 
                    globalVariables.Controllers[globalVariables.Controllers[viewer].senderId] : 
                    globalVariables.Host[socket.sessionId];
                sender.controllers[viewer] = globalVariables.Controllers[viewer];
                if (globalVariables.Host && globalVariables.Host[socket.sessionId]) {
                    globalVariables.Host[socket.sessionId].emit("viewerRegistered", { 
                        id: viewer, 
                        sender: globalVariables.Controllers[viewer].senderId 
                    });
                }
            }
            catch (ex) { }
        });
    }
    if (globalVariables.Controllers[socket.senderId]) {
        delete globalVariables.Controllers[socket.senderId].controllers[socket.id];
        if (!globalVariables.Controllers[socket.senderId].controllers) {
            globalVariables.Controllers[socket.senderId].controllers = {};
        }
    }

    console.log("unregister viewer " + socket.id);

    if (globalVariables.Host && globalVariables.Host[socket.sessionId]) {
        globalVariables.Host[socket.sessionId].emit("viewerLeave", { id: socket.id });
    }
}

module.exports = unregisterController;