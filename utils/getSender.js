const getSender = (sessionId, id) => {
	if (!host || !host[sessionId]) {
		return;
	}
	if (host[sessionId].streamMechanism == "peer") {
		return host[sessionId].id;
	}
	let controllerKeys = Object.keys(controllers);
	if (Object.keys(host[sessionId].controllers).length < 2) {
		return host[sessionId].id;
	}
	let senderId = null;
	for (let idx = 0; idx < controllerKeys.length; idx++) {
		let controller = controllers[controllerKeys[idx]];
		if (!controller) {
			continue;
		}
		if (controller.sessionId != sessionId) {
			continue;
		}
		if (controller.disconnected) {
			controller.disconnect();
			continue;
		}
		if (controller.isMobile == 'true') {
			continue;
		}
		if (Object.keys(controller.controllers).length >= 2) {
			continue;
		}
		if (controller.parents[id]) {
			continue;
		}
		if (controller.senderId == controllers[id].senderId) {
			continue;
		}
		senderId = controller.id;
		break;
	}
	if (!senderId) {
		senderId = host[sessionId].id;
	}
	return senderId;
};
export default { getSender };