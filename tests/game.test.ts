import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../src/game/game.js';
import type { GameSettings } from '../src/shared/types.js';

function makeSettings(overrides: Partial<GameSettings> = {}): GameSettings {
    return {
        czar: 'roundRobin',
        playerHandSize: 5,
        ...overrides
    };
}

function getCurrentCzar(players: any[], game: Game) {
    return players.find((player) => game.isCzar(player.id))!;
}

function playRound(game: Game, players: any[]) {
    const phase = (game as any).state.phase;
    expect(phase).toBe('playCards');

    const czar = getCurrentCzar(players, game);
    const nonCzars = players.filter((player) => player.id !== czar.id);
    expect(nonCzars.length).toBeGreaterThan(0);

    for (const player of nonCzars) {
        const hand = player.getHand();
        expect(hand.length).toBeGreaterThan(0);
        game.playCard(player.id, hand[0].uuid);
    }

    const handLengths = players.map((player) => ({ id: player.id, handLength: player.getHand().length, isCzar: game.isCzar(player.id) }));
        expect(handLengths.some((entry) => entry.isCzar)).toBe(true);
    expect((game as any).state.phase).toBe('chooseWinner');
    return czar;
}

function chooseWinner(game: Game, czar: any) {
    const state = game.playerState(czar.id).state as any;
    expect(state.phase).toBe('chooseWinner');
    expect(Array.isArray(state.choices)).toBe(true);
    expect(state.choices.length).toBeGreaterThan(0);
    game.chooseWinnerCard(czar.id, state.choices[0].uuid);
}

function discardPhase(game: Game, players: any[]) {
    expect((game as any).state.phase).toBe('discardCard');

    for (const player of players) {
        const hand = player.getHand();
        const candidate = hand[0];
        expect(candidate).toBeTruthy();
        game.discardCard(player.id, candidate.uuid);
    }
}

function createCardsPhase(game: Game, players: any[], expectedAmount: number) {
    expect(['createCards', 'createConversation']).toContain((game as any).state.phase);

    for (const player of players) {
        if ((game as any).state.phase === 'playCards') break;

        const state = game.playerState(player.id).state as any;
        if (state.phase === 'createConversation') {
            expect(game.isCzar(player.id)).toBe(true);
            game.createConversation(player.id, `conversation-${player.id}`);
            continue;
        }

        expect(state.phase).toBe('createCards');
        expect(state.amount).toBe(expectedAmount);
        expect(Array.isArray(state.created)).toBe(true);
        for (let i = 0; i < state.amount; i++) {
            game.createCard(player.id, `created-${player.id}-${i}`);
        }
    }

    expect((game as any).state.phase).toBe('playCards');
}

function totalRoundsWon(players: any[]) {
    return players.reduce((sum, player) => sum + player.roundsWonCount(), 0);
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

    it('plays 5 rounds with roundRobin czar and full hand refill', () => {
        const players = [
            game.connectPlayer('alice'),
            game.connectPlayer('bob'),
            game.connectPlayer('carol')
        ];

        game.startGame();

        for (let round = 1; round <= 5; round++) {
            const czar = playRound(game, players);
            chooseWinner(game, czar);

            expect((game as any).state.phase).toBe('createCards');
            createCardsPhase(game, players, 1);

            players.forEach((player) => {
                expect(player.getHand().length).toBe(5);
            });
        }

        expect(totalRoundsWon(players)).toBe(5);
    });

    it('plays 5 rounds with lastWinner czar and discard every 2 rounds', () => {
        game = new Game(makeSettings({ czar: 'lastWinner', playerHandSize: 4, discardCardsEvery: 2 }), null);
        const players = [
            game.connectPlayer('x'),
            game.connectPlayer('y'),
            game.connectPlayer('z')
        ];

        game.startGame();

        for (let round = 1; round <= 5; round++) {
            const czar = playRound(game, players);
            chooseWinner(game, czar);

            if (round % 2 === 0) {
                discardPhase(game, players);
                expect((game as any).state.phase).toBe('createCards');
                createCardsPhase(game, players, 2);
            } else {
                expect((game as any).state.phase).toBe('createCards');
                createCardsPhase(game, players, 1);
            }

            players.forEach((player) => {
                expect(player.getHand().length).toBe(4);
            });
        }

        expect(totalRoundsWon(players)).toBe(5);
    });

    it('rejects cards and conversations longer than 100 characters', () => {
        const players = [
            game.connectPlayer('alice'),
            game.connectPlayer('bob'),
            game.connectPlayer('carol')
        ];

        const czar = players[0];
        const nonCzar = players[1];

        (game as any).state = { phase: 'createCards', createdCards: [], cardsPerPlayer: 1 };
        (game as any).czarId = czar.id;

        expect(() => game.createCard(nonCzar.id, 'x'.repeat(101))).toThrow();
        expect(() => game.createConversation(czar.id, 'x'.repeat(101))).toThrow();
    });

    it('resets all players and game progress', () => {
        const players = [
            game.connectPlayer('alice'),
            game.connectPlayer('bob'),
            game.connectPlayer('carol')
        ];

        game.startGame();
        expect(game.hasStarted()).toBe(true);
        expect(game.connectedPlayers()).toHaveLength(3);

        game.reset();

        expect(game.hasStarted()).toBe(false);
        expect(game.connectedPlayers()).toHaveLength(0);
        expect(() => game.playerState(players[0].id)).toThrow();
    });
});
