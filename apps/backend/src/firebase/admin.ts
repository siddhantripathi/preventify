import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { env } from '../config';

type ServiceAccountJson = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function normalizePrivateKey(rawKey: string) {
  return rawKey.replace(/\\n/g, '\n');
}

function loadServiceAccount() {
  const servicePath = env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (servicePath) {
    const repoRoot = path.resolve(__dirname, '../../../../');
    const absolutePath = path.isAbsolute(servicePath)
      ? servicePath
      : path.resolve(repoRoot, servicePath);
    const raw = fs.readFileSync(absolutePath, 'utf-8');
    const parsed = JSON.parse(raw) as ServiceAccountJson;

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key)
    };
  }

  return {
    projectId: env.FIREBASE_PROJECT_ID!,
    clientEmail: env.FIREBASE_CLIENT_EMAIL!,
    privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY!)
  };
}

export function initFirebase() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(loadServiceAccount())
    });
  }

  if (env.FIREBASE_USE_EMULATOR) {
    if (env.FIREBASE_AUTH_EMULATOR_PORT) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = `${env.FIREBASE_EMULATOR_HOST ?? 'localhost'}:${env.FIREBASE_AUTH_EMULATOR_PORT}`;
    }
    if (env.FIREBASE_FIRESTORE_EMULATOR_PORT) {
      process.env.FIRESTORE_EMULATOR_HOST = `${env.FIREBASE_EMULATOR_HOST ?? 'localhost'}:${env.FIREBASE_FIRESTORE_EMULATOR_PORT}`;
    }
  }

  getAuth();
  return getFirestore();
}

