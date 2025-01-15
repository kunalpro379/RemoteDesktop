class IdGenerator {
    constructor() {
        this.stIdCounter = 0;
    }

    nextUniqueId() {
        this.stIdCounter++;
        return this.stIdCounter.toString();
    }
}

module.exports = IdGenerator;