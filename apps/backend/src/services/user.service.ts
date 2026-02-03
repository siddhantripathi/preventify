import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { UserRole, UserProfile, UserProfileUpdate } from '@preventify/shared';
import { isValidRole, USER_ROLES } from '@preventify/shared';

const USERS_COLLECTION = 'users';
const DEFAULT_ROLE: UserRole = 'doctor';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getFirestore();
  const doc = await db.collection(USERS_COLLECTION).doc(uid).get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  return {
    uid: doc.id,
    email: data.email ?? null,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    role: isValidRole(data.role) ? data.role : DEFAULT_ROLE,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    lastLoginAt: data.lastLoginAt?.toDate() ?? new Date(),
    isActive: data.isActive ?? true
  };
}

export async function createOrUpdateUserOnLogin(
  uid: string,
  email: string | null,
  displayName: string | null,
  photoURL: string | null
): Promise<UserProfile> {
  const db = getFirestore();
  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  const existingDoc = await userRef.get();

  if (existingDoc.exists) {
    await userRef.update({
      email,
      displayName,
      photoURL,
      lastLoginAt: FieldValue.serverTimestamp()
    });
  } else {
    await userRef.set({
      uid,
      email,
      displayName,
      photoURL,
      role: DEFAULT_ROLE,
      createdAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
      isActive: true
    });

    await setUserRole(uid, DEFAULT_ROLE);
  }

  return (await getUserProfile(uid))!;
}

export async function updateUserProfile(
  uid: string,
  updates: UserProfileUpdate
): Promise<UserProfile | null> {
  const db = getFirestore();
  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  const existingDoc = await userRef.get();

  if (!existingDoc.exists) {
    return null;
  }

  const updateData: Record<string, unknown> = {};

  if (updates.displayName !== undefined) {
    updateData.displayName = updates.displayName;
  }
  if (updates.photoURL !== undefined) {
    updateData.photoURL = updates.photoURL;
  }
  if (updates.isActive !== undefined) {
    updateData.isActive = updates.isActive;
  }
  if (updates.role !== undefined && isValidRole(updates.role)) {
    updateData.role = updates.role;
    await setUserRole(uid, updates.role);
  }

  if (Object.keys(updateData).length > 0) {
    await userRef.update(updateData);
  }

  return getUserProfile(uid);
}

export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  if (!USER_ROLES.includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }

  await getAuth().setCustomUserClaims(uid, { role });

  const db = getFirestore();
  await db.collection(USERS_COLLECTION).doc(uid).update({ role });
}

export async function listUsers(limit = 50): Promise<UserProfile[]> {
  const db = getFirestore();
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: doc.id,
      email: data.email ?? null,
      displayName: data.displayName ?? null,
      photoURL: data.photoURL ?? null,
      role: isValidRole(data.role) ? data.role : DEFAULT_ROLE,
      createdAt: data.createdAt?.toDate() ?? new Date(),
      lastLoginAt: data.lastLoginAt?.toDate() ?? new Date(),
      isActive: data.isActive ?? true
    };
  });
}

