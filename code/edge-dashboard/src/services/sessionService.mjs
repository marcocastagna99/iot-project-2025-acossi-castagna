import fetch from 'node-fetch';
import { getRedis } from '../config/redis.mjs';
import https from 'https';
import { env } from '../config/env.mjs';

async function startSessionRequest() {
  const base = env.backendBaseUrl;
  const url = `${base}/session/start`;
  const body = { deviceId: env.deviceId };
  const agent = new https.Agent({ rejectUnauthorized: false });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': env.apiKey
    },
    body: JSON.stringify(body),
    agent: agent
  });
  if (!response.ok) throw new Error(`start session failed status ${response.status}`);
  const jsonResponse = await response.json();
  if (!jsonResponse.sessionId) throw new Error('missing sessionId in response');
  return jsonResponse.sessionId;
}

async function closeSessionRequest(sessionId) {
  const base = env.backendBaseUrl;
  const url = `${base}/session/end`;
  const body = { deviceId: env.deviceId, sessionId: sessionId };
  const agent = new https.Agent({ rejectUnauthorized: false });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': env.apiKey
    },
    body: JSON.stringify(body),
    agent: agent
  });
  if (!response.ok) throw new Error(`end session failed status ${response.status}`);
}

async function setSession(sessionId) {
  const client = await getRedis();
  const ttlSeconds = env.sessionTtlSeconds; 
  await client.set("sessionId", sessionId, { EX: ttlSeconds });
}

async function deleteSession() {
  const client = await getRedis();
  await client.del(env.data.sessionId);
}

async function getSession() {
  const client = await getRedis();
  return await client.get(env.data.sessionId);
}

export async function startSession() {
  const sessionId = await startSessionRequest();
  await setSession(sessionId);
  return sessionId;
}

export async function endSession(sessionId) {
  if (!sessionId) return;
  await closeSessionRequest(sessionId);
  const client = await getRedis();
  await deleteSession();
}

export async function hasSession(id) {
  const currentSessionId = await getSession();
  if (!currentSessionId) return false;
  return currentSessionId === id;
}