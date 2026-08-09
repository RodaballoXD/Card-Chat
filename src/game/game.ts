import { Card, GameSettings, PlayedCard, PlayerState } from "@shared/types";
import { PlayerManager } from "./player";
import { shuffle } from "@shared/helpers";
import { CardList } from "./card-list";
import { GameConnector } from "./game-connector";


export class Game {
    private players: PlayerData[] = [];
    private idCount: number = 0;

    private settings: GameSettings;
    private state: GameState = { phase: null };
    private roundsCount: number = 1;
    private czarId: number | null = null;

    private cardManager = new CardList();

    private connector: GameConnector | null; // TODO: Make a class with this that actually does something


    constructor(settings: GameSettings, connector: GameConnector | null) {
        this.settings = settings;
        this.connector = connector;
    }


    startGame() {
        if (this.state.phase !== null) throw new Error(`Game has already started`);
        this.advanceGamePhase();
    }
    
    playCard(playerId: number, cardUuid: number) {
        if (this.state.phase !== 'playCards') throw new Error(`Cannot play card in phase ${this.state.phase}`);
        const playState = this.state as PlayCardsPhase;
        if (playState.playedCards.some((play) => (play.playerId === playerId))) throw new Error(`Player with id ${playerId} has already played a card`);
        if (this.isCzar(playerId)) throw new Error(`Player with id ${playerId} is the czar and cannot play a card`);

        const player = this.players.find((p) => (p.manager.id === playerId));
        if (!player) throw new Error(`Player with id ${playerId} not found`);

        const cardObj = player.manager.removeCard(cardUuid);
        if (!cardObj) throw new Error(`Player with id ${playerId} does not have card ${cardUuid}`);

        playState.playedCards.push({ playerId, card: cardObj });
        this.tryEndPlayCardsPhase();
    }

    chooseWinnerCard(cardUuid: number) {
        if (this.state.phase !== 'chooseWinner') throw new Error(`Cannot choose winner card in phase ${this.state.phase}`);

        const chooseState = this.state as ChooseWinnerPhase;
        const played = chooseState.playedCards || [];
        const play = played.find((p) => (p.card.uuid === cardUuid));
        if (!play) throw new Error(`Played card with uuid ${cardUuid} not found`);

        chooseState.winnerId = play.playerId;

        const winner = this.players.find((p) => (p.manager.id === play.playerId));
        if (winner) winner.manager.winRound();
        const cardCreator = this.players.find((p) => (p.manager.id === play.card.creatorId));
        if (cardCreator) cardCreator.manager.winOwnCard();

        this.advanceGamePhase();
    }

    createCard(id: number, text: string) {
        if (this.state.phase !== 'createCards') throw new Error(`Cannot create card in phase ${this.state.phase}`);
        if (text.length > 100) throw new Error(`Card text is too long`);

        const createdByIdCount = this.state.createdCards.filter((c) => (c.creatorId === id)).length;
        if (createdByIdCount >= (this.state.cardsPerPlayer ?? 1)) throw new Error(`Player with id ${id} has already created the maximum number of cards`);
        const creator = this.players.find((p) => (p.manager.id === id));
        if (!creator) throw new Error(`Player with id ${id} not found`);
        const creatorHandFull = (creator.manager.getHand().length >= (this.settings.playerHandSize ?? 5));
        if (creatorHandFull) throw new Error(`Player with id ${id} has already created the maximum number of cards`);

        const card: Card = {
            uuid: this.cardManager.uuid(),
            creatorId: id,
            content: text
        };
        this.state.createdCards.push(card);

        const state = this.state;
        const allHaveCreated = this.connectedPlayers().every((p) => {
            const createdByIdCount = state.createdCards.filter((c) => (c.creatorId === p.manager.id)).length;
            return (createdByIdCount >= (state.cardsPerPlayer ?? 1));
        });
        if (allHaveCreated) {
            this.dealCards();
            this.advanceGamePhase();
        }
    }

    discardCard(playerId: number, cardUuid: number | null) {
        if (this.state.phase !== 'discardCard') throw new Error(`Cannot discard card in phase ${this.state.phase}`);
        const discarded = this.state.discardedCards;
        const hasDiscarded = discarded.some((data) => (data.discarderId === playerId));
        if (hasDiscarded) throw new Error(`Player with id ${playerId} has already discarded a card`);

        let cardObj: Card | null = null;
        if (cardUuid !== null) {
            const player = this.players.find((p) => (p.manager.id === playerId));
            if (!player) throw new Error(`Player with id ${playerId} not found`);
            const removed = player.manager.removeCard(cardUuid);
            if (!removed) throw new Error(`Player with id ${playerId} does not have card ${cardUuid}`);
            cardObj = removed;
        }

        discarded.push({ discarderId: playerId, card: cardObj });

        const allHaveDiscarded = this.connectedPlayers().every((p) => (discarded.some((data) => (data.discarderId === p.manager.id))));
        if (allHaveDiscarded) {
            this.advanceGamePhase();
        }
    }

    isCzar(id: number): boolean {
        return (this.czarId === id);
    }


    private advanceGamePhase() {
        const currentPhase = this.state.phase;
        if (currentPhase === null || currentPhase === 'createCards') {
            this.state = {
                phase: 'playCards',
                playedCards: []
            };
            this.connector?.update();
            return;
        }

        if (currentPhase === 'playCards') {
            const prev = this.state as PlayCardsPhase;
            this.state = {
                phase: 'chooseWinner',
                winnerId: null,
                playedCards: prev.playedCards
            };
            this.connector?.update();
            return;
        }

        if (currentPhase === 'chooseWinner' && this.shouldDiscardCards()) {
            this.state = {
                phase: 'discardCard',
                discardedCards: []
            };
            this.newCzar();
            this.connector?.update();
            return;
        }

        if (currentPhase === 'chooseWinner' || currentPhase === 'discardCard') {
            this.state = {
                phase: 'createCards',
                createdCards: [],
                cardsPerPlayer: (this.shouldDiscardCards()) ? 2 : undefined
            };
            if (currentPhase === 'chooseWinner') this.newCzar();
            this.connector?.update();
            this.roundsCount++;
            return;
        }

        throw new Error(`Unknown phase ${currentPhase}`);
    }


    private shouldDiscardCards(): boolean {
        return !!((this.settings.discardCardsEvery) && ((this.roundsCount % this.settings.discardCardsEvery) === 0));
    }

    private tryEndPlayCardsPhase() {
        const playedCards = (this.state as PlayCardsPhase).playedCards;
        const playingPlayers = this.connectedPlayers().filter((p) => (!this.isCzar(p.manager.id)));
        const allHavePlayed = playingPlayers.every((p) => (playedCards.some((c) => (c.playerId === p.manager.id))));
        if (allHavePlayed) {
            this.advanceGamePhase();
        }
    }

    private newCzar() {
        if (this.state.phase !== 'chooseWinner') throw new Error(`Cannot set czar in phase ${this.state.phase}`);

        const isWinner = (this.settings.czar === 'lastWinner');
        if (isWinner) {
            this.czarId = this.state.winnerId;
        }
        const currentId = this.czarId ?? -1;
        let best: number | null = null;
        // Find smallest that is bigger than `currentId`
        for (const player of this.players) {
            const playerId = player.manager.id;
            if (playerId > currentId && (best === null || playerId < best)) {
                best = playerId;
            }
        }
        if (best === null) {
            best = Math.min(...this.players.map((p) => p.manager.id));
        }
        this.czarId = best;
    }

    private dealCards() {
        if (this.state.phase !== 'createCards') throw new Error(`Cannot deal cards in phase ${this.state.phase}`);

        const connected = this.connectedPlayers();

        const playerDrawData: { id: number; createdCards: Card[]; need: number }[] = [];
        for (const player of connected) {
            const id = player.manager.id;
            const createdCards = this.state.createdCards.filter((c) => (c.creatorId === id));
            const need = (this.settings.playerHandSize ?? 5) - player.manager.getHand().length;

            playerDrawData.push({ id, createdCards, need });
        }

        const shuffled = shuffle(playerDrawData);
        for (let i = 0; i < shuffled.length; i++) {
            const data = shuffled[i];
            const nextPlayerData = shuffled[i + 1] ?? shuffled[0];
            const manager = this.players.find((p) => (p.manager.id === data.id))!.manager;

            for (let j = 0; j < data.need; j++) {
                const card = nextPlayerData.createdCards[j] ?? this.cardManager.presetCard();
                manager.giveCard(card);
            }
        }
    }


    connectPlayer(name: string) {
        const newPlayer = new PlayerManager(this.idCount++, name);
        this.players.push({ isConnected: true, manager: newPlayer});
        return newPlayer;
    }

    disconnectPlayer(id: number) {
        const player = this.players.find((p) => (p.manager.id === id));
        if (!player) throw new Error(`Player with id ${id} not found`);
        player.isConnected = false;
    }

    reconnectPlayer(id: number) {
        const player = this.players.find((p) => (p.manager.id === id));
        if (!player) throw new Error(`Player with id ${id} not found`);
        player.isConnected = true;
    }

    connectedPlayers(): PlayerData[] {
        return this.players.filter((p) => (p.isConnected));
    }

    playerState(playerId: number): PlayerState {
        const player = this.players.find((p) => (p.manager.id === playerId));
        if (!player) throw new Error(`Player with id ${playerId} not found`);

        const players: PlayerState['players'] = this.players.map((p) => ({
            id: p.manager.id,
            name: p.manager.name,
            isConnected: p.isConnected,
            isCzar: this.isCzar(p.manager.id),
            roundsWon: p.manager.roundsWonCount(),
            winningCards: p.manager.winningCardsCount()
        }));

        let state: PlayerState["state"];

        if (this.state.phase === 'playCards') {
            const s = this.state as PlayCardsPhase;
            const played = s.playedCards.find((p) => (p.playerId === playerId));
            state = {
                phase: 'playCards',
                conversation: [],
                played: played ? played.card : null
            };
            return { playerId, players, hand: player.manager.getHand(), state };
        }
        
        if (this.state.phase === 'chooseWinner') {
            const s = this.state as ChooseWinnerPhase;
            if (this.isCzar(playerId)) {
                state = {
                    phase: 'chooseWinner',
                    conversation: [],
                    choices: s.playedCards.map((p) => p.card)
                };
            } else {
                state = {
                    phase: 'awaitWinnerChoice',
                    conversation: []
                };
            }
            return { playerId, players, hand: player.manager.getHand(), state };
        }

        if (this.state.phase === 'createCards') {
            const s = this.state as CreateCardsPhase;
            const created = s.createdCards.filter((c) => (c.creatorId === playerId));
            state = {
                phase: 'createCards',
                amount: s.cardsPerPlayer ?? 1,
                created
            };
            return { playerId, players, hand: player.manager.getHand(), state };
        }

        // Fallback for other phases (discardCard or null)
        state = { phase: 'playCards', conversation: [], played: null };
        return { playerId, players, hand: player.manager.getHand(), state };
    }
}



interface PlayerData {
    isConnected: boolean;
    manager: PlayerManager;
}

type GameState = PlayCardsPhase | ChooseWinnerPhase | CreateCardsPhase | DiscardCardPhase | { phase: null };

interface PlayCardsPhase {
    phase: 'playCards';
    playedCards: PlayedCard[];
}

interface ChooseWinnerPhase {
    phase: 'chooseWinner';
    winnerId: number | null;
    playedCards: PlayedCard[];
}

interface CreateCardsPhase {
    phase: 'createCards';
    createdCards: Card[];
    cardsPerPlayer?: number;
}

interface DiscardCardPhase {
    phase: 'discardCard';
    discardedCards: { discarderId: number; card: Card | null }[];
}
