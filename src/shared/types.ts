export interface Card {
    uuid: number;
    creatorId: number | null;
    content: string;
}

export interface GameSettings {
    playerHandSize?: number; // Default = 5
    keepChat?: boolean; // Whether rounds get the chat from the previous one or starts over with a new starting message
    initialMessage?: boolean; // Only for `keepChat = true`. Whether a first message should be generated before first round
    playerCreatedInitalMessages?: boolean; // First message of entire game is created by a random player rather than picked a preset
    pointsToWin?: number | null; // If falsey, don't end game ever
    pointsPerRoundWon?: number; // Default = 1; Points earned winning a round
    pointsPerWinnerCard?: number; // Default = 0; Amount of points when a card created by you gets selected as winner
    czar: 'lastWinner' | 'roundRobin' | 'none'; // Who decides the winner card. Starts at a random player. `'none'` means `'roundRobin'`, but asks the client for everyone to vote
    discardCardsEvery?: number | null; // If falsey, don't discard cards ever. Otherwise, discard and create 1 extra card every N rounds
}

export type GamePhase = 'playCards' | 'chooseWinner' | 'createCards' | 'discardCard';

export interface PlayedCard {
    playerId: number
    card: Card;
}

export interface PlayerState {
    playerId: number;
    players: {
        id: number;
        name: string;
        isConnected: boolean;
        isCzar: boolean;
        roundsWon: number;
        winningCards: number;
    }[];
    hand: Card[];
    state: PlayCardState | ChooseWinnerStateCzar | ChooseWinnerStateNormal | CreateCardsState | CreateConversationStateCzar | DiscardCardState | null;
}

interface PlayCardState {
    phase: 'playCards';
    conversation: Message[];
    played: Card | null;
}

interface ChooseWinnerStateCzar {
    phase: 'chooseWinner';
    conversation: Message[];
    choices: Card[];
}

interface ChooseWinnerStateNormal {
    phase: 'awaitWinnerChoice';
    conversation: Message[];
}

interface CreateCardsState {
    phase: 'createCards';
    amount: number;
    created: Card[];
}

interface CreateConversationStateCzar {
    phase: 'createConversation';
    created: Message | null;
}

interface DiscardCardState {
    phase: 'discardCard';
    discarded: Card | null | 'none';
}

export interface Message {
    sender: string;
    text: string;
}