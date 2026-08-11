import { Server, Socket } from "socket.io";
import { Game } from "./game.js";


export class GameConnector {
    private readonly playerSockets = new Map<number, Socket>();
    private readonly socketPlayers = new Map<string, number>();

    constructor(
        private readonly io: Server,
        private readonly game: Game
    ) {
        io.on("connection", (socket) => {
            this.handleConnection(socket);
        });
    }


    private handleConnection(socket: Socket) {
        socket.on("joinGame", (name: string) => {
            this.expectType(name, "string", socket);
            this.joinGame(socket, name);
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

        socket.on("chooseWinner", (cardId: number) => {
            this.expectType(cardId, "number", socket);
            this.handleAction(socket, () => {
                const playerId = this.getPlayerId(socket);

                if (!this.game.isCzar(playerId)) {
                    throw new Error("You are not the czar");
                }

                this.game.chooseWinnerCard(cardId);
            });
        });

        socket.on("discardCard", (cardId: number | null) => {
            this.expectType(cardId, "number", socket);
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


    private joinGame(socket: Socket, name: string) {
        if (this.socketPlayers.has(socket.id)) {
            this.sendError(socket, "You are already in the game");
            return;
        }

        try {
            const player = this.game.connectPlayer(name);

            this.playerSockets.set(player.id, socket);
            this.socketPlayers.set(socket.id, player.id);

            this.update();

            this.tryStartGame();
        } catch (error) {
            this.sendError(socket, error);
        }
    }

    private tryStartGame() {
        const connectedCount = this.game.connectedPlayers().length;
        if (connectedCount >= 3) {
            try {
                this.game.startGame();
            } catch (err) {
                // If game cannot be started (already started or other), ignore.
            }
        }
    }


    private handleDisconnect(socket: Socket) {
        const playerId = this.socketPlayers.get(socket.id);

        if (playerId === undefined) return;

        this.socketPlayers.delete(socket.id);
        this.playerSockets.delete(playerId);

        try {
            this.game.disconnectPlayer(playerId);
            this.update();
        } catch (error) {
            console.error("Error disconnecting player:", error);
        }
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
}
