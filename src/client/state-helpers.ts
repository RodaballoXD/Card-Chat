import type { PlayerState } from "../shared/types.js";

export function hasConversation(state: PlayerState["state"]): boolean {
    return !!state && (state.phase === "playCards" || state.phase === "chooseWinner" || state.phase === "awaitWinnerChoice");
}

export function actionRequiresCards(state: PlayerState["state"]): boolean {
    return !!state && (state.phase === "playCards" || state.phase === "discardCard");
}

export function canCreateCard(state: PlayerState["state"]): boolean {
    if (!state || state.phase !== "createCards") {
        return false;
    }

    return (state.created?.length ?? 0) < (state.amount ?? 1);
}

export function canDiscardCard(state: PlayerState["state"]): boolean {
    if (!state || state.phase !== "discardCard") {
        return false;
    }

    return state.discarded === null;
}

export function exceedsMaxLength(text: string, maxLength: number): boolean {
    return text.length > maxLength;
}
