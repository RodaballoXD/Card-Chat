import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../src/game/game';
import { Card, GameSettings, PlayerState } from '../src/shared/types';
import { GameConnector } from '../src/game/game-connector';

function makeSettings(): GameSettings {
    return { czar: 'roundRobin', discardCardsEvery: 3 };
}

describe('Game', () => {
    let game: Game;

    beforeEach(() => {
        game = new Game(makeSettings(), null);
    });

    it('connectPlayer returns a player and playerState reflects hand', () => {
        const player = game.connectPlayer('alice');
        expect(player.id).toBeDefined();

        const state = game.playerState(player.id);
        expect(state.playerId).toBe(player.id);
        expect(Array.isArray(state.hand)).toBe(true);
    });

    it('playCard removes card from hand and registers played card', () => {
        const p1 = game.connectPlayer('p1');
        const p2 = game.connectPlayer('p2');

        // give p1 a preset card
        const card = { uuid: 1, creatorId: null, content: 'x' };
        p1.giveCard(card);

        game.startGame(); // moves to playCards

        game.playCard(p1.id, 1);

        const s1 = game.playerState(p1.id);
        expect(s1.state.phase).toBe('playCards');
        // played should be the card that was played
        expect((s1.state as any).played).toEqual(card);
    });

    it('discardCard removes card from hand when uuid provided', () => {
        const p = game.connectPlayer('d');
        const card = { uuid: 10, creatorId: null, content: 'd' };
        p.giveCard(card);

        // Force discard phase
        (game as any).state = { phase: 'discardCard', discardedCards: [] };

        game.discardCard(p.id, 10);
        const s: PlayerState = game.playerState(p.id);
        expect(s.hand.find((c) => c.uuid === 10)).toBeUndefined();
    });
});
