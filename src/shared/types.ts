export interface Card {
    creatorId: number;
    content: string;
}

export interface GameSettings {
    playerHandSize?: number; // Default = 7
    keepChat?: boolean; // Whether rounds get the chat from the previous one or starts over with a new starting message
    initialMessage?: boolean; // Only for `keepChat = true`. Whether a first message should be generated before first round
    playerCreatedInitalMessages?: boolean; // First message of entire game is created by a random player rather than picked a preset
    pointsToWin?: number | null; // If falsey, don't end game ever
    pointsPerRoundWon?: number; // Default = 1; Points earned winning a round
    pointsPerWinnerCard?: number; // Default = 0; Amount of points when a card created by you gets selected as winner
    czar: 'lastWinner' | 'roundRobin' | 'none'; // Who decides the winner card. Starts at a random player. `'none'` means `'roundRobin'`, but asks the client for everyone to vote
}