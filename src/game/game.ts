import type { Card, GameSettings, Message, PlayedCard, PlayerState } from "../shared/types.js";
import { PlayerManager } from "./player.js";
import { shuffle } from "../shared/helpers.js";
import { CardList } from "./card-list.js";
import type { GameConnector } from "./game-connector.js";


export class Game {
    private players: PlayerData[] = [];
    private idCount: number = 0;

    private settings: GameSettings;
    private state: GameState = { phase: null };
    private roundsCount: number = 1;
    private czarId: number | null = null;
    private conversation: Message[] = [];

    private cardManager = new CardList();

    private connector: GameConnector | null;
    private czarDisconnectTimeout: NodeJS.Timeout | undefined = undefined;

    constructor(settings: GameSettings, connector: GameConnector | null) {
        this.settings = settings;
        this.connector = connector;
    }

    connectConnector(connector: GameConnector) {
        this.connector = connector;
    }

    hasStarted(): boolean {
        return this.state.phase !== null;
    }

    reset() {
        this.players = [];
        this.idCount = 0;
        this.state = { phase: null };
        this.roundsCount = 1;
        this.czarId = null;
        this.conversation = [];
        this.cardManager = new CardList();
        this.settings = { czar: 'roundRobin' };
        if (this.czarDisconnectTimeout) clearTimeout(this.czarDisconnectTimeout);
    }

    changeSetting(setting: keyof GameSettings, value: unknown) {
        if (this.state.phase !== null) throw new Error(`Cannot change settings after game has started`);

        switch (setting) {
            case 'czar':
                if (value !== 'lastWinner' && value !== 'roundRobin' ) throw new Error(`Invalid czar setting value ${value}`);
                this.settings.czar = value;
                break;
            case 'playerHandSize':
                if (typeof value !== 'number' || value < 1) throw new Error(`Invalid playerHandSize setting value ${value}`);
                this.settings.playerHandSize = value;
                break;
            case 'keepChat':
                if (typeof value !== 'boolean') throw new Error(`Invalid keepChat setting value ${value}`);
                this.settings.keepChat = value;
                break;
            case 'discardCardsEvery':
                if (value !== null && (typeof value !== 'number' || value < 1)) throw new Error(`Invalid discardCardsEvery setting value ${value}`);
                this.settings.discardCardsEvery = value;
                break;
            default:
                throw new Error(`Unknown setting ${setting}`);
        }
    }


    startGame() {
        if (this.state.phase !== null) throw new Error(`Game has already started`);
        if (!this.settings.keepChat) this.conversation = [{ senderId: null, sender: 'Card Chat', text: this.cardManager.startingMessage() }];
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

    chooseWinnerCard(playerId: number, cardUuid: number) {
        if (this.state.phase !== 'chooseWinner') throw new Error(`Cannot choose winner card in phase ${this.state.phase}`);
        if (!this.isCzar(playerId)) throw new Error(`Only the czar can choose the winner card`);

        const chooseState = this.state as ChooseWinnerPhase;
        const played = chooseState.playedCards || [];
        const play = played.find((p) => (p.card.uuid === cardUuid));
        if (!play) throw new Error(`Played card with uuid ${cardUuid} not found`);

        chooseState.winnerId = play.playerId;

        const winner = this.players.find((p) => (p.manager.id === play.playerId))!;
        if (winner) winner.manager.winRound();
        const cardCreator = this.players.find((p) => (p.manager.id === play.card.creatorId));
        if (cardCreator) cardCreator.manager.winOwnCard();

        const czar = this.players.find((p) => (p.manager.id === this.czarId))!;
        let sender; let senderId;
        if (this.settings.keepChat) {
            sender = czar.manager.name;
            senderId = czar.manager.id;
        } else {
            sender = winner.manager.name;
            senderId = winner.manager.id;
        }
        this.conversation.push({ senderId, sender, text: `${play.card.content}` });

        this.connector?.sendWinnerScreen({
            conversation: this.conversation,
            winnerCard: play.card,
            winnerName: winner.manager.name,
            creatorName: cardCreator?.manager.name ?? null
        });
        this.advanceGamePhase();
    }

    createCard(id: number, text: string) {
        if (this.state.phase !== 'createCards') throw new Error(`Cannot create card in phase ${this.state.phase}`);
        if (text.length > 100) throw new Error(`Card text is too long`);

        const createdByIdCount = this.state.createdCards.filter((c) => (c.creatorId === id)).length;
        if (createdByIdCount >= (this.state.cardsPerPlayer ?? 1)) throw new Error(`Player with id ${id} has already created the maximum number of cards`);
        const creator = this.players.find((p) => (p.manager.id === id));
        if (!creator) throw new Error(`Player with id ${id} not found`);
        if (this.isCzar(id)) throw new Error(`Player with id ${id} is the czar and cannot create cards`);

        const card: Card = {
            uuid: this.cardManager.uuid(),
            creatorId: id,
            content: text
        };
        this.state.createdCards.push(card);

        this.tryEndCreateCardsPhase();
    }

    createConversation(id: number, text: string) {
        if (this.state.phase !== 'createCards') throw new Error(`Cannot create conversation in phase ${this.state.phase}`);
        if (!this.isCzar(id)) throw new Error(`Player with id ${id} is not the czar and cannot create conversation`);
        if (text.length > 100) throw new Error(`Conversation text is too long`);

        const creator = this.players.find((p) => (p.manager.id === id));
        if (!creator) throw new Error(`Player with id ${id} not found`);

        const message: Message = {
            senderId: creator.manager.id,
            sender: creator.manager.name,
            text
        };
        this.conversation = [message];

        this.tryEndCreateCardsPhase();
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
            if (currentPhase === null && this.czarId === null && this.players.length > 0) {
                this.czarId = Math.min(...this.players.map((p) => p.manager.id));
            }
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
            this.newCzar();
            this.state = {
                phase: 'discardCard',
                discardedCards: []
            };
            if (this.settings.keepChat) this.conversation = [];
            this.connector?.update();
            return;
        }

        if (currentPhase === 'chooseWinner' || currentPhase === 'discardCard') {
            if (currentPhase === 'chooseWinner') this.newCzar();
            this.state = {
                phase: 'createCards',
                createdCards: [],
                cardsPerPlayer: (this.shouldDiscardCards()) ? 2 : undefined
            };
            this.conversation = [];
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

    private tryEndCreateCardsPhase() {
        if (this.state.phase !== 'createCards') throw new Error(`Cannot check create cards phase in phase ${this.state.phase}`);
        const state = this.state;
        const creatingPlayers = this.connectedPlayers().filter((p) => (!this.isCzar(p.manager.id)));
        const allHaveCreated = creatingPlayers.every((p) => {
            const createdByIdCount = state.createdCards.filter((c) => (c.creatorId === p.manager.id)).length;
            return (createdByIdCount >= (state.cardsPerPlayer ?? 1));
        });
        const conversationIsCreated = (this.settings.keepChat || this.conversation.length > 0);
        if (allHaveCreated && conversationIsCreated) {
            this.dealCards();
            this.advanceGamePhase();
        }
    }

    private newCzar() {
        const isWinner = (this.settings.czar === 'lastWinner');

        if (isWinner && (this.state.phase === 'chooseWinner')) {
            this.czarId = this.state.winnerId;
        }
        const currentId = this.czarId ?? -1;
        let best: number | null = null;
        // Find smallest that is bigger than `currentId`
        for (const player of this.connectedPlayers()) {
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

        const shuffled = shuffle(this.state.createdCards);
        const handSize = this.settings.playerHandSize ?? 5;
        for (const player of this.players) {
            const cardsNeeded = handSize - player.manager.getHand().length;
            for (let i = 0; i < cardsNeeded; i++) {
                const card = shuffled.pop() ?? this.cardManager.presetCard();
                player.manager.giveCard(card);
            }
        }
    }


    connectPlayer(name: string) {
        const newPlayer = new PlayerManager(this.idCount++, name);
        this.players.push({ isConnected: true, manager: newPlayer});
        newPlayer.setHand(Array.from({ length: this.settings.playerHandSize ?? 5 }, () => this.cardManager.presetCard()));
        return newPlayer;
    }

    disconnectPlayer(id: number) {
        const player = this.players.find((p) => (p.manager.id === id));
        if (!player) throw new Error(`Player with id ${id} not found`);
        player.isConnected = false;
        if (this.isCzar(id)) {
            this.czarDisconnectTimeout = setTimeout(() => {
                this.state = { phase: 'createCards', createdCards: [] };
                if (!this.settings.keepChat) this.conversation = [];
                this.newCzar();
                this.connector?.update();
                this.connector?.sendWinnerScreen({ conversation: this.conversation, winnerCard: null, winnerName: null, creatorName: null });
            }, 10000);
        }
    }

    reconnectPlayer(id: number) {
        if (this.isCzar(id)) clearTimeout(this.czarDisconnectTimeout);
        const player = this.players.find((p) => (p.manager.id === id));
        if (!player) throw new Error(`Player with id ${id} not found`);
        player.isConnected = true;
        return player.manager;
    }

    connectedPlayers(): PlayerData[] {
        return this.players.filter((p) => (p.isConnected));
    }

    playerState(playerId: number): PlayerState {
        const player = this.players.find((p) => (p.manager.id === playerId));
        if (!player) throw new Error(`Player with id ${playerId} not found`);

        const players: PlayerState['players'] = this.connectedPlayers().map((p) => ({
            id: p.manager.id,
            name: p.manager.name,
            isConnected: p.isConnected,
            isCzar: this.isCzar(p.manager.id),
            roundsWon: p.manager.roundsWonCount(),
            winningCards: p.manager.winningCardsCount()
        }));

        let state: PlayerState["state"];

        if (this.state.phase === 'playCards') {
            const phaseState = this.state as PlayCardsPhase;
            const played = phaseState.playedCards.find((p) => (p.playerId === playerId));
            state = {
                phase: 'playCards',
                conversation: [...this.conversation],
                played: (played) ? played.card : null
            };
            return { playerId, players, hand: player.manager.getHand(), state };
        }
        
        if (this.state.phase === 'chooseWinner') {
            const phaseState = this.state as ChooseWinnerPhase;
            if (this.isCzar(playerId)) {
                state = {
                    phase: 'chooseWinner',
                    conversation: [...this.conversation],
                    choices: [...phaseState.playedCards.map((p) => p.card)]
                };
            } else {
                state = {
                    phase: 'awaitWinnerChoice',
                    conversation: [...this.conversation]
                };
            }
            return { playerId, players, hand: player.manager.getHand(), state };
        }

        if (this.state.phase === 'createCards') {
            const phaseState = this.state as CreateCardsPhase;
            const created = phaseState.createdCards.filter((c) => (c.creatorId === playerId));
            if (this.isCzar(playerId)) {
                if (this.settings.keepChat) state = {
                    phase: 'wait',
                    text: 'Esperando a que los jugadores creen cartas'
                };
                else state = {
                    phase: 'createConversation',
                    created: (this.conversation.length > 0) ? this.conversation[0] : null
                };
            } else {
                state = {
                    phase: 'createCards',
                    amount: phaseState.cardsPerPlayer ?? 1,
                    created
                };
            }
            return { playerId, players, hand: [...player.manager.getHand()], state };
        }

        if (this.state.phase === 'discardCard') {
            const phaseState = this.state as DiscardCardPhase;
            const discarded = phaseState.discardedCards.find((d) => (d.discarderId === playerId));
            return { playerId, players, hand: [...player.manager.getHand()], state: {
                phase: 'discardCard',
                discarded: (discarded === undefined) ? null : (discarded.card ?? 'none')
            } };
        }

        return { playerId, players, hand: [...player.manager.getHand()], state: { phase: 'wait', text: 'Esperando a que inicie la partida. Se requieren 3 jugadores' } };
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
