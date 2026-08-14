const PLAYER_UUID_KEY = "card-chat-player-uuid";

export function getStoredPlayerUuid(): string | null {
    return localStorage.getItem(PLAYER_UUID_KEY);
}

export function getOrCreatePlayerUuid(): string {
    const existing = getStoredPlayerUuid();
    if (existing) return existing;

    const uuid = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(PLAYER_UUID_KEY, uuid);
    return uuid;
}

export function clearStoredPlayer() {
    localStorage.removeItem(PLAYER_UUID_KEY);
}
