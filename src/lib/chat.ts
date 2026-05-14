"use client";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "./firebase";

export type ChatMessage = {
  id: string;
  uid: string;
  name: string;
  seed: string;
  text: string;
  ts: number;
};

export async function sendChatMessage(
  code: string,
  uid: string,
  name: string,
  seed: string,
  text: string,
): Promise<void> {
  const clean = text.trim().slice(0, 200);
  if (!clean) return;
  const db = getDb();
  await addDoc(collection(db, "normalRooms", code, "chat"), {
    uid,
    name,
    seed,
    text: clean,
    ts: serverTimestamp(),
  });
}

export function subscribeChat(
  code: string,
  cb: (msgs: ChatMessage[]) => void,
): () => void {
  const db = getDb();
  const q = query(
    collection(db, "normalRooms", code, "chat"),
    orderBy("ts", "desc"),
    limit(50),
  );
  return onSnapshot(
    q,
    (snap) => {
      const out: ChatMessage[] = [];
      snap.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        const tsRaw = data.ts as { toMillis?: () => number } | number | null;
        const ts =
          tsRaw && typeof tsRaw === "object" && typeof tsRaw.toMillis === "function"
            ? tsRaw.toMillis()
            : typeof tsRaw === "number"
              ? tsRaw
              : Date.now();
        out.push({
          id: d.id,
          uid: String(data.uid ?? ""),
          name: String(data.name ?? ""),
          seed: String(data.seed ?? ""),
          text: String(data.text ?? ""),
          ts,
        });
      });
      cb(out.reverse());
    },
    () => cb([]),
  );
}
