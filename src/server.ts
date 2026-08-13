import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { Server } from "socket.io";
import { Game } from "./game/game.js";
import { GameConnector } from "./game/game-connector.js";

const publicDirectory = new URL("../public/", import.meta.url);

const httpServer = createServer(async (request, response) => {
    const url = request.url ?? "/";

    if (url.startsWith("/socket.io")) {
        return;
    }

    if (url === "/") {
        return serveFile(response, new URL("index.html", publicDirectory), "text/html; charset=utf-8");
    }

    if (url === "/style.css") {
        return serveFile(response, new URL("style.css", publicDirectory), "text/css; charset=utf-8");
    }

    if (url.startsWith("/client/") || url.startsWith("/shared/")) {
        const assetPath = new URL(`../dist${url}`, import.meta.url);
        const contentType = url.endsWith(".js")
            ? "application/javascript; charset=utf-8"
            : url.endsWith(".css")
                ? "text/css; charset=utf-8"
                : "application/octet-stream";

        return serveFile(response, assetPath, contentType);
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
});

const io = new Server(httpServer);

const game = new Game({ czar: "roundRobin" }, null);

const connector = new GameConnector(io, game);
game.connectConnector(connector);

const port = Number(process.env.PORT ?? 3000);

httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
});

async function serveFile(response: import("node:http").ServerResponse, fileUrl: URL, contentType: string) {
    try {
        const data = await readFile(fileUrl);
        response.writeHead(200, { "Content-Type": contentType });
        response.end(data);
    } catch (error) {
        console.error(`Failed to serve ${fileUrl.pathname}:`, error);
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
    }
}