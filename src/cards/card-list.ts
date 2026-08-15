import { shuffle } from "../shared/helpers.js";
import type { Card } from "../shared/types.js";
import { PRESET_CARDS, PRESET_STARTERS } from "./don't-read.js";

export class CardList {
    private uuidCount: number = 0;
    private presetCards: string[] = PRESET_CARDS;
    private remainingCards: string[] = [];
    private strarterCards: string[] = PRESET_STARTERS;
    
    constructor() {
        this.presetCards = shuffle(this.presetCards);
        this.remainingCards = [...this.presetCards];
    }


    uuid() {
        return this.uuidCount++;
    }

    presetCard(): Card {
        if (this.remainingCards.length === 0) this.remainingCards = [...this.presetCards];
        return {
            uuid: this.uuid(),
            creatorId: null,
            content: this.remainingCards.pop()!
        };
    }

    startingMessage(): string {
        return this.strarterCards[Math.floor(Math.random() * this.strarterCards.length)];
    }
}
