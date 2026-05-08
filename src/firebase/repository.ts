import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import type { TimeEntry, UserSettings } from "../types";
import { getFirebaseClients } from "./config";

export type AuthMode = "sign-in" | "sign-up";

function requireClients() {
  const clients = getFirebaseClients();
  if (!clients) {
    throw new Error("Firebase is not configured.");
  }
  return clients;
}

export function listenToAuthState(
  onChange: (user: User | null) => void,
): () => void {
  const { auth } = requireClients();
  return onAuthStateChanged(auth, onChange);
}

export async function authenticateWithEmail(
  mode: AuthMode,
  email: string,
  password: string,
): Promise<void> {
  const { auth } = requireClients();
  if (mode === "sign-up") {
    await createUserWithEmailAndPassword(auth, email, password);
    return;
  }
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logoutFromFirebase(): Promise<void> {
  const { auth } = requireClients();
  await signOut(auth);
}

export function subscribeToCloudSettings(
  userId: string,
  onChange: (settings: UserSettings | null) => void,
  onError: (error: Error) => void,
): () => void {
  const { db } = requireClients();
  return onSnapshot(
    doc(db, "users", userId, "settings", "current"),
    (snapshot) => onChange(snapshot.exists() ? (snapshot.data() as UserSettings) : null),
    onError,
  );
}

export function subscribeToCloudEntries(
  userId: string,
  onChange: (entries: TimeEntry[]) => void,
  onError: (error: Error) => void,
): () => void {
  const { db } = requireClients();
  const entriesCollection = collection(db, "users", userId, "timeEntries");

  return onSnapshot(
    entriesCollection,
    (snapshot) =>
      onChange(
        snapshot.docs
          .map((entryDoc) => {
            const data = entryDoc.data() as TimeEntry;
            return {
              id: data.id,
              date: data.date,
              startTime: data.startTime,
              endTime: data.endTime,
              source: data.source,
              note: data.note,
            };
          })
          .sort((a, b) =>
            `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`),
          ),
      ),
    onError,
  );
}

export async function saveCloudSettings(
  userId: string,
  settings: UserSettings,
): Promise<void> {
  const { db } = requireClients();
  await setDoc(doc(db, "users", userId, "settings", "current"), {
    ...settings,
    updatedAt: serverTimestamp(),
  });
}

export async function saveCloudEntry(
  userId: string,
  entry: TimeEntry,
): Promise<void> {
  const { db } = requireClients();
  await setDoc(doc(db, "users", userId, "timeEntries", entry.id), {
    ...entry,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCloudEntry(
  userId: string,
  entryId: string,
): Promise<void> {
  const { db } = requireClients();
  await deleteDoc(doc(db, "users", userId, "timeEntries", entryId));
}

export async function uploadLocalDataToCloud(
  userId: string,
  settings: UserSettings,
  entries: TimeEntry[],
): Promise<void> {
  const { db } = requireClients();
  const batch = writeBatch(db);

  batch.set(doc(db, "users", userId, "settings", "current"), {
    ...settings,
    updatedAt: serverTimestamp(),
  });

  entries.forEach((entry) => {
    batch.set(doc(db, "users", userId, "timeEntries", entry.id), {
      ...entry,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}
