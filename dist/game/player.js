export class PlayerManager {
    constructor(id, name) {
        this.hand = [];
        this.wonRounds = 0;
        this.winningCards = 0;
        this.id = id;
        this.name = name;
    }
    setHand(hand) {
        this.hand = hand;
    }
    giveCard(card) {
        this.hand.push(card);
    }
    getHand() {
        return this.hand;
    }
    removeCard(uuid) {
        const idx = this.hand.findIndex((c) => (c.uuid === uuid));
        if (idx === -1)
            return undefined;
        const [removed] = this.hand.splice(idx, 1);
        return removed;
    }
    winRound() {
        this.wonRounds++;
    }
    roundsWonCount() {
        return this.wonRounds;
    }
    winOwnCard() {
        this.winningCards++;
    }
    winningCardsCount() {
        return this.winningCards;
    }
}
//# sourceMappingURL=player.js.map