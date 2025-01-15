const kurento = require('kurento-client');

class KurentoClientManager {
    constructor(kurentoIP, kurentoPort) {
        this.wsUri = `ws://${kurentoIP}:${kurentoPort}/kurento`;
        this.kurentoClient = null;
    }

    getKurentoClient(callback) {
        if (this.kurentoClient) {
            return callback(null, this.kurentoClient);
        }

        kurento(this.wsUri, (error, client) => {
            if (error) {
                console.error(`Could not find media server at ${this.wsUri}`);
                return callback(error);
            }
            this.kurentoClient = client;
            callback(null, this.kurentoClient);
        });
    }
}

module.exports = KurentoClientManager;
