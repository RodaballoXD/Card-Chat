import type { PlayCardState, PlayerState, WinnerScreen } from "../shared/types.js";
import { canDiscardCard } from "./state-helpers.js";

export interface ClientState {
    selectedCardId: number | null;
    selectableAction: SelectableAction | null;
    errorMessage: string;
    errorTimeout: number | null;
    winnerScreen: WinnerScreen | null;
    winnerCloseEnabled: boolean;
    winnerCloseTimeout: number | null;
    ownPlayerName: string;
}

export type SelectableAction = "play-card" | "choose-winner" | "discard-card";

export function createClientState(): ClientState {
    return {
        selectedCardId: null,
        selectableAction: null,
        errorMessage: "",
        errorTimeout: null,
        winnerScreen: null,
        winnerCloseEnabled: false,
        winnerCloseTimeout: null,
        ownPlayerName: "",
    };
}

export function resetClientState(state: ClientState) {
    state.selectedCardId = null;
    state.selectableAction = null;
    state.winnerScreen = null;
    state.winnerCloseEnabled = false;
    state.ownPlayerName = "";

    if (state.winnerCloseTimeout !== null) {
        window.clearTimeout(state.winnerCloseTimeout);
        state.winnerCloseTimeout = null;
    }
}

export function getOwnPlayerName(state: PlayerState): string {
    return state.players.find((player) => player.id === state.playerId)?.name ?? "";
}

export function getSelectableAction(state: PlayerState): SelectableAction | null {
    const ownPlayer = state.players.find((player) => player.id === state.playerId);
    const phase = state.state?.phase;

    if (phase === "playCards") {
        if (ownPlayer?.isCzar) return null;
        if ((state.state as PlayCardState).played) return null;
        return "play-card";
    }

    if (phase === "chooseWinner") {
        return "choose-winner";
    }

    if (phase === "discardCard") {
        return canDiscardCard(state.state) ? "discard-card" : null;
    }

    return null;
}
