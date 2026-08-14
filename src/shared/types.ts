export interface Card {
    uuid: number;
    creatorId: number | null;
    content: string;
}

export interface GameSettings {
    playerHandSize?: number; // Default = 5
    keepChat?: boolean; // Whether rounds get the chat from the previous one or starts over with a new starting message
    czar: 'lastWinner' | 'roundRobin' ; // Who decides the winner card.
    discardCardsEvery?: number | null; // If falsey, don't discard cards ever. Otherwise, discard and create 1 extra card every N rounds

    // Not implemented:
    initialMessage?: boolean; // Only for `keepChat = true`. Whether a first message should be generated before first round
    playerCreatedInitalMessage?: boolean; // First message of entire game is created by a random player rather than picked a preset
    pointsToWin?: number | null; // If falsey, don't end game ever
    pointsPerRoundWon?: number; // Default = 1; Points earned winning a round
    pointsPerWinnerCard?: number; // Default = 0; Amount of points when a card created by you gets selected as winner
}

export type GamePhase = 'playCards' | 'chooseWinner' | 'createCards' | 'discardCard';

export interface PlayedCard {
    playerId: number
    card: Card;
}

export interface PlayerState {
    playerId: number;
    players: Player[];
    hand: Card[];
    state: PlayCardState | ChooseWinnerStateCzar | ChooseWinnerStateNormal | CreateCardsState | CreateConversationStateCzar | DiscardCardState | WaitingScreen;
}

export interface Player {
    id: number;
    name: string;
    isConnected: boolean;
    isCzar: boolean;
    roundsWon: number;
    winningCards: number;
}

export interface PlayCardState {
    phase: 'playCards';
    conversation: Message[];
    played: Card | null;
}

export interface ChooseWinnerStateCzar {
    phase: 'chooseWinner';
    conversation: Message[];
    choices: Card[];
}

export interface ChooseWinnerStateNormal {
    phase: 'awaitWinnerChoice';
    conversation: Message[];
}

export interface CreateCardsState {
    phase: 'createCards';
    amount: number;
    created: Card[];
}

export interface CreateConversationStateCzar {
    phase: 'createConversation';
    created: Message | null;
}

export interface DiscardCardState {
    phase: 'discardCard';
    discarded: Card | null | 'none';
}

export interface WaitingScreen {
    phase: 'wait';
    text: string;
}

export interface Message {
    senderId: number | null;
    sender: string;
    text: string;
}


export type WinnerScreen = WinnerScreenSuccesfull | WinnerScreenNoWinner;

interface WinnerScreenSuccesfull {
    conversation: Message[];
    winnerCard: Card;
    winnerName: string;
    creatorName: string | null;
}

interface WinnerScreenNoWinner {
    conversation: Message[];
    winnerCard: null;
    winnerName: null;
    creatorName: null;
}