class PresenterManager {
    constructor() {
        this.presenters = {};
        this.noPresenterMessage = 'No active presenter. Try again later...';
    }

    setPresenter(sessionId, presenterData) {
        this.presenters[sessionId] = presenterData;
    }

    getPresenter(sessionId) {
        return this.presenters[sessionId];
    }

    removePresenter(sessionId) {
        if (this.presenters[sessionId]) {
            this.presenters[sessionId].pipeline?.release();
            delete this.presenters[sessionId];
        }
    }

    hasPresenter(sessionId) {
        return !!this.presenters[sessionId];
    }
}

module.exports = PresenterManager;
