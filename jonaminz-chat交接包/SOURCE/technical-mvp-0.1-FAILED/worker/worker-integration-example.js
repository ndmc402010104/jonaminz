/*
把以下概念「最小接線」進既有 worker.js。
不是完整 replacement。
*/

import { ChatRoomHub } from "./chat-room-hub.js";
import {
  chatBootstrap,
  chatSendMessage,
  chatMarkRead,
  chatSetReaction,
  connectChatSocket
} from "./chat-actions.js";

export { ChatRoomHub };

// 在既有 fetch() 的 OAuth route 後、OPTIONS/POST 判斷前：
//
// if (request.method === "GET" && url.pathname === "/chat/socket") {
//   return connectChatSocket(request, env, url);
// }
//
// 在既有 action switch 加：
//
// case "chatBootstrap":
//   result = await chatBootstrap(env, payload);
//   break;
// case "chatSendMessage":
//   result = await chatSendMessage(env, payload);
//   break;
// case "chatMarkRead":
//   result = await chatMarkRead(env, payload);
//   break;
// case "chatSetReaction":
//   result = await chatSetReaction(env, payload);
//   break;
//
// 注意：WebSocket URL token 放 query string 會出現在 client history/devtools。
// MVP 可接受，但正式版建議先呼叫 action 換一次性 socket ticket，再用 ticket 連線。
