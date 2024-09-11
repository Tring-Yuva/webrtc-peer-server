import { createServer } from "http";
import path from "path";
import SocketService from "./socket";
import express from "express";

const app = express();

app.use("/", express.static(path.join(__dirname, "static")));

const httpServer = createServer(app);

let port = process.env.PORT || 80;

const socketService = new SocketService();

socketService.init(httpServer);

httpServer.listen(port);
console.log("Server started on ", port);

socketService.getIO();
