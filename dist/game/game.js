import { PlayerManager } from "./player.js";
import { shuffle } from "../shared/helpers.js";
import { CardList } from "./card-list.js";
export class Game {
    constructor(settings, connector) {
        this.players = [];
        this.idCount = 0;
        this.state = { phase: null };
        this.roundsCount = 1;
        this.czarId = null;
        this.conversation = [];
        this.cardManager = new CardList();
        this.settings = settings;
        this.connector = connector;
    }
    connectConnector(connector) {
        this.connector = connector;
    }
    startGame() {
        if (this.state.phase !== null)
            throw new Error(`Game has already started`);
        this.advanceGamePhase();
    }
    playCard(playerId, cardUuid) {
        if (this.state.phase !== 'playCards')
            throw new Error(`Cannot play card in phase ${this.state.phase}`);
        const playState = this.state;
        if (playState.playedCards.some((play) => (play.playerId === playerId)))
            throw new Error(`Player with id ${playerId} has already played a card`);
        if (this.isCzar(playerId))
            throw new Error(`Player with id ${playerId} is the czar and cannot play a card`);
        const player = this.players.find((p) => (p.manager.id === playerId));
        if (!player)
            throw new Error(`Player with id ${playerId} not found`);
        const cardObj = player.manager.removeCard(cardUuid);
        if (!cardObj)
            throw new Error(`Player with id ${playerId} does not have card ${cardUuid}`);
        playState.playedCards.push({ playerId, card: cardObj });
        this.tryEndPlayCardsPhase();
    }
    chooseWinnerCard(cardUuid) {
        if (this.state.phase !== 'chooseWinner')
            throw new Error(`Cannot choose winner card in phase ${this.state.phase}`);
        const chooseState = this.state;
        const played = chooseState.playedCards || [];
        const play = played.find((p) => (p.card.uuid === cardUuid));
        if (!play)
            throw new Error(`Played card with uuid ${cardUuid} not found`);
        chooseState.winnerId = play.playerId;
        const winner = this.players.find((p) => (p.manager.id === play.playerId));
        if (winner)
            winner.manager.winRound();
        const cardCreator = this.players.find((p) => (p.manager.id === play.card.creatorId));
        if (cardCreator)
            cardCreator.manager.winOwnCard();
        this.advanceGamePhase();
    }
    createCard(id, text) {
        if (this.state.phase !== 'createCards')
            throw new Error(`Cannot create card in phase ${this.state.phase}`);
        if (text.length > 100)
            throw new Error(`Card text is too long`);
        const createdByIdCount = this.state.createdCards.filter((c) => (c.creatorId === id)).length;
        if (createdByIdCount >= (this.state.cardsPerPlayer ?? 1))
            throw new Error(`Player with id ${id} has already created the maximum number of cards`);
        const creator = this.players.find((p) => (p.manager.id === id));
        if (!creator)
            throw new Error(`Player with id ${id} not found`);
        if (this.isCzar(id))
            throw new Error(`Player with id ${id} is the czar and cannot create cards`);
        const card = {
            uuid: this.cardManager.uuid(),
            creatorId: id,
            content: text
        };
        this.state.createdCards.push(card);
        const state = this.state;
        const creatingPlayers = this.connectedPlayers().filter((p) => (!this.isCzar(p.manager.id)));
        const allHaveCreated = creatingPlayers.every((p) => {
            const createdByIdCount = state.createdCards.filter((c) => (c.creatorId === p.manager.id)).length;
            return (createdByIdCount >= (state.cardsPerPlayer ?? 1));
        });
        if (allHaveCreated) {
            this.dealCards();
            this.advanceGamePhase();
        }
    }
    createConversation(id, text) {
        if (this.state.phase !== 'createCards')
            throw new Error(`Cannot create conversation in phase ${this.state.phase}`);
        if (!this.isCzar(id))
            throw new Error(`Player with id ${id} is not the czar and cannot create conversation`);
        if (text.length > 200)
            throw new Error(`Conversation text is too long`);
        const creator = this.players.find((p) => (p.manager.id === id));
        if (!creator)
            throw new Error(`Player with id ${id} not found`);
        const message = {
            sender: creator.manager.name,
            text
        };
        this.conversation = [message];
    }
    discardCard(playerId, cardUuid) {
        if (this.state.phase !== 'discardCard')
            throw new Error(`Cannot discard card in phase ${this.state.phase}`);
        const discarded = this.state.discardedCards;
        const hasDiscarded = discarded.some((data) => (data.discarderId === playerId));
        if (hasDiscarded)
            throw new Error(`Player with id ${playerId} has already discarded a card`);
        let cardObj = null;
        if (cardUuid !== null) {
            const player = this.players.find((p) => (p.manager.id === playerId));
            if (!player)
                throw new Error(`Player with id ${playerId} not found`);
            const removed = player.manager.removeCard(cardUuid);
            if (!removed)
                throw new Error(`Player with id ${playerId} does not have card ${cardUuid}`);
            cardObj = removed;
        }
        discarded.push({ discarderId: playerId, card: cardObj });
        const allHaveDiscarded = this.connectedPlayers().every((p) => (discarded.some((data) => (data.discarderId === p.manager.id))));
        if (allHaveDiscarded) {
            this.advanceGamePhase();
        }
    }
    isCzar(id) {
        return (this.czarId === id);
    }
    advanceGamePhase() {
        const currentPhase = this.state.phase;
        if (currentPhase === null || currentPhase === 'createCards') {
            if (currentPhase === null && this.czarId === null && this.settings.czar !== 'none' && this.players.length > 0) {
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
            const prev = this.state;
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
            this.connector?.update();
            return;
        }
        if (currentPhase === 'chooseWinner' || currentPhase === 'discardCard') {
            if (currentPhase === 'chooseWinner')
                this.newCzar();
            this.state = {
                phase: 'createCards',
                createdCards: [],
                cardsPerPlayer: (this.shouldDiscardCards()) ? 2 : undefined
            };
            this.connector?.update();
            this.roundsCount++;
            return;
        }
        throw new Error(`Unknown phase ${currentPhase}`);
    }
    shouldDiscardCards() {
        return !!((this.settings.discardCardsEvery) && ((this.roundsCount % this.settings.discardCardsEvery) === 0));
    }
    tryEndPlayCardsPhase() {
        const playedCards = this.state.playedCards;
        const playingPlayers = this.connectedPlayers().filter((p) => (!this.isCzar(p.manager.id)));
        const allHavePlayed = playingPlayers.every((p) => (playedCards.some((c) => (c.playerId === p.manager.id))));
        if (allHavePlayed) {
            this.advanceGamePhase();
        }
    }
    newCzar() {
        if (this.state.phase !== 'chooseWinner')
            throw new Error(`Cannot set czar in phase ${this.state.phase}`);
        const isWinner = (this.settings.czar === 'lastWinner');
        if (isWinner) {
            this.czarId = this.state.winnerId;
        }
        const currentId = this.czarId ?? -1;
        let best = null;
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
    dealCards() {
        if (this.state.phase !== 'createCards')
            throw new Error(`Cannot deal cards in phase ${this.state.phase}`);
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
    connectPlayer(name) {
        const newPlayer = new PlayerManager(this.idCount++, name);
        this.players.push({ isConnected: true, manager: newPlayer });
        newPlayer.setHand(Array.from({ length: this.settings.playerHandSize ?? 5 }, () => this.cardManager.presetCard()));
        return newPlayer;
    }
    disconnectPlayer(id) {
        const player = this.players.find((p) => (p.manager.id === id));
        if (!player)
            throw new Error(`Player with id ${id} not found`);
        player.isConnected = false;
    }
    reconnectPlayer(id) {
        const player = this.players.find((p) => (p.manager.id === id));
        if (!player)
            throw new Error(`Player with id ${id} not found`);
        player.isConnected = true;
    }
    connectedPlayers() {
        return this.players.filter((p) => (p.isConnected));
    }
    playerState(playerId) {
        const player = this.players.find((p) => (p.manager.id === playerId));
        if (!player)
            throw new Error(`Player with id ${playerId} not found`);
        const players = this.players.map((p) => ({
            id: p.manager.id,
            name: p.manager.name,
            isConnected: p.isConnected,
            isCzar: this.isCzar(p.manager.id),
            roundsWon: p.manager.roundsWonCount(),
            winningCards: p.manager.winningCardsCount()
        }));
        let state;
        if (this.state.phase === 'playCards') {
            const s = this.state;
            const played = s.playedCards.find((p) => (p.playerId === playerId));
            state = {
                phase: 'playCards',
                conversation: this.conversation,
                played: played ? played.card : null
            };
            return { playerId, players, hand: player.manager.getHand(), state };
        }
        if (this.state.phase === 'chooseWinner') {
            const s = this.state;
            if (this.isCzar(playerId)) {
                state = {
                    phase: 'chooseWinner',
                    conversation: this.conversation,
                    choices: s.playedCards.map((p) => p.card)
                };
            }
            else {
                state = {
                    phase: 'awaitWinnerChoice',
                    conversation: this.conversation
                };
            }
            return { playerId, players, hand: player.manager.getHand(), state };
        }
        if (this.state.phase === 'createCards') {
            const s = this.state;
            const created = s.createdCards.filter((c) => (c.creatorId === playerId));
            if (this.isCzar(playerId)) {
                if (this.settings.keepChat)
                    state = null;
                else
                    state = {
                        phase: 'createConversation',
                        created: null
                    };
            }
            else {
                state = {
                    phase: 'createCards',
                    amount: s.cardsPerPlayer ?? 1,
                    created
                };
            }
            return { playerId, players, hand: player.manager.getHand(), state };
        }
        if (this.state.phase === 'discardCard') {
            const s = this.state;
            const discarded = s.discardedCards.find((d) => (d.discarderId === playerId));
            return { playerId, players, hand: player.manager.getHand(), state: {
                    phase: 'discardCard',
                    discarded: (discarded === undefined) ? null : (discarded.card ?? 'none')
                } };
        }
        return { playerId, players, hand: player.manager.getHand(), state: null };
    }
}
//# sourceMappingURL=game.js.map