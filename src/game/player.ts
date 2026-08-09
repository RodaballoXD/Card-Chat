import { Card } from "@shared/types";

export class PlayerManager {
    readonly id: number;
    readonly name: string;

    private hand: Card[] = [];

    private wonRounds: number = 0;
    private winningCards: number = 0;

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
    }

    setHand(hand: Card[]) {
        this.hand = hand;
    }
    giveCard(card: Card) {
        this.hand.push(card);
    }
    getHand(): Card[] {
        return this.hand;
    }

    removeCard(uuid: number): Card | undefined {
        const idx = this.hand.findIndex((c) => (c.uuid === uuid));
        if (idx === -1) return undefined;
        const [removed] = this.hand.splice(idx, 1);
        return removed;
    }

    winRound() {
        this.wonRounds++;
    }
    roundsWonCount(): number {
        return this.wonRounds;
    }
    winOwnCard() {
        this.winningCards++;
    }
    winningCardsCount(): number {
        return this.winningCards;
    }
}
