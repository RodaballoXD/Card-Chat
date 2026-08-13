import { Server, Socket } from "socket.io";
import { Game } from "./game.js";
import { GameSettings, WinnerScreen } from "../shared/types.js";


export class GameConnector {
    private readonly playerSockets = new Map<number, Socket>();
    private readonly socketPlayers = new Map<string, number>();
    private readonly playerUuids = new Map<string, number>();

    constructor(
        private readonly io: Server,
        private readonly game: Game
    ) {
        io.on("connection", (socket) => {
            this.handleConnection(socket);
        });
    }


    private handleConnection(socket: Socket) {
        socket.on("changeSettings", (setting: keyof GameSettings, value: unknown) => {
            this.handleAction(socket, () => {
                this.game.changeSetting(setting, value);
            });
        });

        socket.on("joinGame", (data: JoinGameData) => {
            const joinData = this.parseJoinGameData(data, socket);
            if (!joinData) return;
            this.joinGame(socket, joinData.name, joinData.playerUuid);
        });

        socket.on("reconnectGame", (playerUuid: string) => {
            this.expectType(playerUuid, "string", socket);
            this.reconnectGame(socket, playerUuid);
        });

        socket.on("playCard", (cardId: number) => {
            this.expectType(cardId, "number", socket);
            this.handleAction(socket, () => {
                this.game.playCard(this.getPlayerId(socket), cardId);
            });
        });

        socket.on("createCard", (text: string) => {
            this.expectType(text, "string", socket);
            this.handleAction(socket, () => {
                this.game.createCard(this.getPlayerId(socket), text);
            });
        });

        socket.on("createConversation", (text: string) => {
            this.expectType(text, "string", socket);
            this.handleAction(socket, () => {
                this.game.createConversation(this.getPlayerId(socket), text);
            });
        });

        socket.on("chooseWinner", (cardId: number) => {
            this.expectType(cardId, "number", socket);
            this.handleAction(socket, () => {
                this.game.chooseWinnerCard(
                    this.getPlayerId(socket),
                    cardId
                );
            });
        });

        socket.on("discardCard", (cardId: number | null) => {
            if (cardId !== null) {
                this.expectType(cardId, "number", socket);
            }
            this.handleAction(socket, () => {
                this.game.discardCard(
                    this.getPlayerId(socket),
                    cardId
                );
            });
        });

        socket.on("disconnect", () => {
            this.handleDisconnect(socket);
        });
    }


    private joinGame(socket: Socket, name: string, playerUuid: string) {
        if (this.socketPlayers.has(socket.id)) {
            this.sendError(socket, "You are already in the game");
            return;
        }

        try {
            if (this.playerUuids.has(playerUuid)) {
                this.reconnectGame(socket, playerUuid);
                return;
            }

            const player = this.game.connectPlayer(name);

            this.playerSockets.set(player.id, socket);
            this.socketPlayers.set(socket.id, player.id);
            this.playerUuids.set(playerUuid, player.id);

            this.update();

            this.tryStartGame();
        } catch (error) {
            this.sendError(socket, error);
        }
    }

    private reconnectGame(socket: Socket, playerUuid: string) {
        if (this.socketPlayers.has(socket.id)) {
            this.sendError(socket, "You are already in the game");
            return;
        }

        const playerId = this.playerUuids.get(playerUuid);
        if (playerId === undefined) {
            socket.emit("joinRequired");
            return;
        }

        try {
            const previousSocket = this.playerSockets.get(playerId);
            if (previousSocket) {
                this.socketPlayers.delete(previousSocket.id);
            }

            const player = this.game.reconnectPlayer(playerId);
            this.playerSockets.set(player.id, socket);
            this.socketPlayers.set(socket.id, player.id);
            this.update();
            this.tryStartGame();
        } catch (error) {
            this.playerUuids.delete(playerUuid);
            socket.emit("joinRequired");
        }
    }

    private tryStartGame() {
        const connectedCount = this.game.connectedPlayers().length;
        if (connectedCount >= 3) {
            try {
                this.game.startGame();
                this.update();
            } catch (err) {
                // If game cannot be started (already started or other), ignore.
            }
        }
    }


    private handleDisconnect(socket: Socket) {
        const playerId = this.socketPlayers.get(socket.id);

        if (playerId === undefined) return;
        if (this.playerSockets.get(playerId) !== socket) {
            this.socketPlayers.delete(socket.id);
            return;
        }

        this.socketPlayers.delete(socket.id);
        this.playerSockets.delete(playerId);

        try {
            this.game.disconnectPlayer(playerId);
            if (this.shouldResetGame()) {
                this.resetGame();
                return;
            }
            this.update();
        } catch (error) {
            console.error("Error disconnecting player:", error);
        }
    }

    private shouldResetGame(): boolean {
        return this.game.hasStarted() && this.game.connectedPlayers().length <= 1;
    }

    private resetGame() {
        this.io.emit("gameReset");
        this.playerSockets.clear();
        this.socketPlayers.clear();
        this.playerUuids.clear();
        this.game.reset();
    }


    private handleAction(socket: Socket, action: () => void) {
        try {
            action();
            this.update();
        } catch (error) {
            this.sendError(socket, error);
        }
    }

    private expectType(value: unknown, type: string, socket: Socket) {
        if (typeof value !== type) {
            this.sendError(socket, `Expected ${type}, got ${typeof value}`);
        }
    }


    update() {
        for (const [playerId, socket] of this.playerSockets) {
            try {
                const state = this.game.playerState(playerId);
                socket.emit("gameState", state);
            } catch (error) {
                console.error(
                    `Could not create state for player ${playerId}:`,
                    error
                );
            }
        }
    }

    sendWinnerScreen(screen: WinnerScreen) {
        for (const [playerId, socket] of this.playerSockets) {
            try {
                socket.emit("winnerScreen", screen);
            } catch (error) {
                console.error(
                    `Could not send winner screen to player ${playerId}:`,
                    error
                );
            }
        }
    }


    private getPlayerId(socket: Socket): number {
        const playerId = this.socketPlayers.get(socket.id);

        if (playerId === undefined) {
            throw new Error("You are not connected to a game");
        }

        return playerId;
    }


    private sendError(socket: Socket, error: unknown) {
        const message =
            error instanceof Error
              ? error.message
              : "Unknown error";

        socket.emit("gameError", { message });
    }

    private parseJoinGameData(data: JoinGameData, socket: Socket): { name: string; playerUuid: string } | null {
        if (typeof data === "string") {
            this.sendError(socket, "Missing player UUID");
            return null;
        }

        if (!data || typeof data !== "object") {
            this.sendError(socket, "Invalid join data");
            return null;
        }

        if (typeof data.name !== "string") {
            this.sendError(socket, "Expected player name");
            return null;
        }

        if (typeof data.playerUuid !== "string") {
            this.sendError(socket, "Expected player UUID");
            return null;
        }

        return {
            name: data.name.trim(),
            playerUuid: data.playerUuid.trim()
        };
    }
}

type JoinGameData = string | {
    name?: unknown;
    playerUuid?: unknown;
};
