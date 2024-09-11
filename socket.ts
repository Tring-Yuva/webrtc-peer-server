import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";

interface RTCMessage {
  label?: string;
  id?: string;
  candidate?: string;
  sdp?: string;
}

interface CallData {
  calleeId: string;
  rtcMessage: RTCMessage;
}

interface AnswerData {
  callerId: string;
  rtcMessage: RTCMessage;
}

interface ICECandidateData {
  calleeId: string;
  rtcMessage: RTCMessage;
}

interface CallInfo {
  startTime: number;
}

export default class SocketService {
  private io: Server | null = null;
  private activeCalls: Map<string, CallInfo> = new Map(); // Track active calls

  // Initialize socket.io server
  public init(httpServer: HttpServer): void {
    this.io = new Server(httpServer, {
      transports: ["websocket", "polling"],
    });

    // Middleware to set user information from handshake query
    this.io.use((socket: Socket, next) => {
      const { callerId } = socket.handshake.query;
      if (callerId) {
        socket.data.user = callerId;
        next();
      } else {
        next(new Error("Invalid callerId"));
      }
    });

    this.io.on("connection", (socket: Socket) => {
      const user = socket.data.user;
      console.log(`${user} connected`);
      socket.join(user);

      // Handle call initiation
      socket.on("call", (data: CallData) => {
        const { calleeId, rtcMessage } = data;
        console.log(`${user} calling ${calleeId}`);

        // Emit 'newCall' event to the callee
        socket.to(calleeId).emit("newCall", {
          callerId: user,
          rtcMessage,
        });
      });

      // Handle call answering
      socket.on("answerCall", (data: AnswerData) => {
        const { callerId, rtcMessage } = data;
        console.log(`${user} answered call from ${callerId}`);

        // Emit 'callAnswered' event to the caller
        socket.to(callerId).emit("callAnswered", {
          callee: user,
          rtcMessage,
        });
      });

      // Handle ICE candidate exchange
      socket.on("ICEcandidate", (data: ICECandidateData) => {
        const { calleeId, rtcMessage } = data;
        console.log(`${user} sending ICE candidate to ${calleeId}`);

        // Emit 'ICEcandidate' to the callee
        socket.to(calleeId).emit("ICEcandidate", {
          sender: user,
          rtcMessage,
        });
      });

      // Handle call end
      socket.on("endCall", () => {
        const callInfo = this.activeCalls.get(user);
        if (callInfo) {
          const endTime = Date.now();
          const duration = endTime - callInfo.startTime;

          console.log(`Call ended. Duration: ${duration / 1000} seconds`);

          // Remove the call from active calls map
          this.activeCalls.delete(user);
        } else {
          console.log("No active call to end");
        }
      });

      // Clean up on disconnect
      socket.on("disconnect", () => {
        console.log(`${user} disconnected`);
        this.activeCalls.delete(user); // Clean up any active call tracking
      });
    });
  }

  // Method to get the current IO instance
  public getIO(): Server {
    if (!this.io) {
      throw new Error("SocketService not initialized.");
    }
    return this.io;
  }
}
