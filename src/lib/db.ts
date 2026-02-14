import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";
import { db } from "./firebase";
import type { Message } from "../App";

type MemoryInput = {
  title: string;
  detail: string;
  createdAt: number;
};

export const addMessage = async (
  uid: string,
  threadId: string,
  message: Omit<Message, "id">
) => {
  const messagesRef = collection(db, "users", uid, "threads", threadId, "messages");
  await addDoc(messagesRef, message);
};

export const listenMessages = (
  uid: string,
  threadId: string,
  onUpdate: (messages: Message[]) => void
) => {
  const messagesRef = collection(db, "users", uid, "threads", threadId, "messages");
  const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"), limit(100));
  return onSnapshot(messagesQuery, (snapshot) => {
    const nextMessages: Message[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Message, "id">)
    }));
    onUpdate(nextMessages);
  });
};

export const addMemory = async (uid: string, memory: MemoryInput) => {
  const memoryRef = collection(db, "users", uid, "memories");
  await addDoc(memoryRef, memory);
};

export const listenMemories = (
  uid: string,
  onUpdate: (items: Array<MemoryInput & { id: string }>) => void
) => {
  const memoryRef = collection(db, "users", uid, "memories");
  const memoryQuery = query(memoryRef, orderBy("createdAt", "desc"), limit(24));
  return onSnapshot(memoryQuery, (snapshot) => {
    const next = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as MemoryInput)
    }));
    onUpdate(next);
  });
};
