import { getRedis } from '../config/redis.mjs';
import { classifyDomain } from '../ai/classifier.mjs';
import { env } from '../config/env.mjs';
import https from 'https';
import fetch from 'node-fetch';

function key(sessionId) {
  return `${sessionId}:${env.data.chat}`;
}

async function submitInteraction(sessionId, question, answer) {
  const response = await fetch(`${env.backendBaseUrl}/interaction/submit`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': env.apiKey
    },
    body: JSON.stringify({ deviceId: env.deviceId, sessionId, question, answer }),
    agent: new https.Agent({ rejectUnauthorized: false })
  });
  if (!response.ok) throw new Error(`submit interaction failed with status ${response.status}`);
  return;
}

async function askInteraction(sessionId, question, dataAnalysis = false) {
  const url = `${env.backendBaseUrl}/interaction/ask`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': env.apiKey
    },
    body: JSON.stringify({ deviceId: env.deviceId, sessionId, question, dataAnalysis: !!dataAnalysis }),
    agent: new https.Agent({ rejectUnauthorized: false })
  });
  if (!response.ok) throw new Error(`ask interaction failed with status ${response.status}, body: ${await response.text()}`);
  return response.json();
}

export async function addUserMessage(sessionId, content, dataAnalysis = false) {
  const client = await getRedis();
  const entry = JSON.stringify({ role: 'user', content, ts: Date.now(), dataAnalysis });
  await client.rPush(key(sessionId), entry);
}

export async function addBotMessage(sessionId, content) {
  const client = await getRedis();
  const entry = JSON.stringify({ role: 'bot', content, ts: Date.now() });
  await client.rPush(key(sessionId), entry);
}

export async function getMessages(sessionId) {
  const client = await getRedis();
  const raw = await client.lRange(key(sessionId), 0, -1);
  const messages = raw.map(m => {
    try { return JSON.parse(m); } catch { return m; }
  });
  
  if (messages.length === 0) {
    const welcomeMessage = {
      role: 'bot',
      content: env.welcomeMessage,
      ts: Date.now()
    };
    await client.rPush(key(sessionId), JSON.stringify(welcomeMessage));
    messages.push(welcomeMessage);
  }
  
  return messages;
}

export async function deleteChat(sessionId) {
  const client = await getRedis();
  await client.del(key(sessionId));
}

export async function handleChatMessage(sessionId, rawMessage, dataAnalysis = false) {
  const message = rawMessage.trim();
  if(!message) throw new Error('empty message');

  const messages = await getMessages(sessionId);
  const userHistory = messages
    .filter(m => m.role === 'user')
    .map(m => m.content);

  await addUserMessage(sessionId, message, dataAnalysis);

  let domainResult = { valid: true };
  if(env.intentDetectionEnabled) {
     console.log('Classifying domain');
     domainResult = await classifyDomain(message, userHistory);
  }
  if (!domainResult.valid) {
    const rejectionMessage = domainResult.message;
    await addBotMessage(sessionId, rejectionMessage);
    await submitInteraction(sessionId, message, rejectionMessage);
    return { answer: rejectionMessage, rejected: true };
  }
  else {
    const { answer, chunks } = await askInteraction(sessionId, message, dataAnalysis);
    await addBotMessage(sessionId, answer);
    return { answer, chunks };
  }
}