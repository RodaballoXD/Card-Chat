import { GameSettings } from "@shared/types";
import { PlayerManager } from "./player";


export class Game {
    private players: PlayerManager[] = [];
    private idCount: number = 0;
    private settings: GameSettings;

    constructor(settings: GameSettings) {
        this.settings = settings;
    }

    connectPlayer(name: string) {
        const newPlayer = new PlayerManager(this.idCount++, name);
        this.players.push(newPlayer);
    }

    disconnectPlayer(id: number) {
        const remaining = this.players.filter((p) => (p.id !== id));
        if (remaining.length !== this.players.length - 1) throw new Error(`PlayerManager with id ${id} not found or multiple players with the same id found`);
        this.players = remaining;
    }
}
