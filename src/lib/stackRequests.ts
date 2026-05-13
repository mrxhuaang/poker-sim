"use client";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "./firebase";

export type StackRequestType = "join" | "rebuy";
export type StackRequestStatus = "pending" | "approved" | "rejected";

export type StackRequest = {
  uid: string;
  name: string;
  seed: string;
  requestedStack: number;
  type: StackRequestType;
  status: StackRequestStatus;
  rejectionReason?: string;
  ts: number;
};

export async function submitStackRequest(
  code: string,
  req: Omit<StackRequest, "status">,
): Promise<void> {
  const db = getDb();
  await setDoc(doc(db, "normalRooms", code, "stackRequests", req.uid), {
    ...req,
    status: "pending",
  });
}

export function subscribeStackRequests(
  code: string,
  cb: (reqs: StackRequest[]) => void,
): () => void {
  const db = getDb();
  const q = query(
    collection(db, "normalRooms", code, "stackRequests"),
    orderBy("ts", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as StackRequest)),
    () => cb([]),
  );
}

export function subscribeMyStackRequest(
  code: string,
  uid: string,
  cb: (req: StackRequest | null) => void,
): () => void {
  const db = getDb();
  return onSnapshot(
    doc(db, "normalRooms", code, "stackRequests", uid),
    (snap) => cb(snap.exists() ? (snap.data() as StackRequest) : null),
    () => cb(null),
  );
}

export async function rejectStackRequest(
  code: string,
  uid: string,
  reason?: string,
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, "normalRooms", code, "stackRequests", uid), {
    status: "rejected",
    rejectionReason: reason ?? "",
  });
}

export async function dismissStackRequest(
  code: string,
  uid: string,
): Promise<void> {
  const db = getDb();
  await deleteDoc(doc(db, "normalRooms", code, "stackRequests", uid));
}
