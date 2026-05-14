"use client";
import { useEffect, useState } from "react";
import { subscribeChat, type ChatMessage } from "@/lib/chat";

export function useChat(code: string | null): ChatMessage[] {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  useEffect(() => {
    if (!code) {
      setMsgs([]);
      return;
    }
    return subscribeChat(code, setMsgs);
  }, [code]);
  return msgs;
}
