"use client";
import { useEffect, useState } from "react";
import {
  subscribeNormalRoom,
  subscribeNormalLobby,
  subscribeNormalHole,
  type NormalRoomDoc,
  type NormalHoleDoc,
  type NormalLobbyPlayer,
} from "@/lib/normalRooms";
import {
  subscribeStackRequests,
  type StackRequest,
} from "@/lib/stackRequests";

export function useNormalRoom(code: string | null) {
  const [room, setRoom] = useState<NormalRoomDoc | null | undefined>(undefined);
  useEffect(() => {
    if (!code) { setRoom(null); return; }
    return subscribeNormalRoom(code, setRoom);
  }, [code]);
  return room;
}

export function useNormalLobby(code: string | null): NormalLobbyPlayer[] {
  const [list, setList] = useState<NormalLobbyPlayer[]>([]);
  useEffect(() => {
    if (!code) { setList([]); return; }
    return subscribeNormalLobby(code, setList);
  }, [code]);
  return list;
}

export function useStackRequests(code: string | null): StackRequest[] {
  const [reqs, setReqs] = useState<StackRequest[]>([]);
  useEffect(() => {
    if (!code) { setReqs([]); return; }
    return subscribeStackRequests(code, setReqs);
  }, [code]);
  return reqs;
}

export function useNormalHole(code: string | null, seatId: string | null) {
  const [hole, setHole] = useState<NormalHoleDoc | null | undefined>(undefined);
  useEffect(() => {
    if (!code || !seatId) { setHole(null); return; }
    return subscribeNormalHole(code, seatId, setHole);
  }, [code, seatId]);
  return hole;
}
