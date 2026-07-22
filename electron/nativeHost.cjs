#!/usr/bin/env node
// Native Messaging Host for LinkFetcher Chrome Extension
// Chrome launches this script each time the extension sends a message.
// Reads stdin (4-byte length + JSON), writes to named pipe, exits.

const net = require('net');
const path = require('path');
const fs = require('fs');

const PIPE_NAME = '\\\\.\\pipe\\linkfetcher-native';
const PIPE_UNIX = '/tmp/linkfetcher-native.sock';
const isWin = process.platform === 'win32';

function getPipePath() {
  if (isWin) return PIPE_NAME;
  return PIPE_UNIX;
}

// ── Read one message from Chrome (stdin) ──────────────────────────────────────

function readMessage() {
  return new Promise((resolve, reject) => {
    const header = Buffer.alloc(4);
    let bytesRead = 0;

    function onChunk(chunk) {
      const copy = chunk.slice(0, 4 - bytesRead);
      copy.copy(header, bytesRead);
      bytesRead += copy.length;

      if (bytesRead < 4) {
        process.stdin.once('data', onChunk);
        return;
      }

      const msgLen = header.readUInt32LE(0);
      if (msgLen === 0) { resolve(null); return; }
      if (msgLen > 1024 * 1024) { reject(new Error('too large')); return; }

      let body = Buffer.alloc(0);
      function onBody(chunk2) {
        body = Buffer.concat([body, chunk2]);
        if (body.length < msgLen) {
          process.stdin.once('data', onBody);
          return;
        }
        try {
          resolve(JSON.parse(body.toString('utf8', 0, msgLen)));
        } catch {
          reject(new Error('invalid json'));
        }
      }

      process.stdin.once('data', onBody);
    }

    process.stdin.once('data', onChunk);
  });
}

// ── Send message to Electron via named pipe ───────────────────────────────────

function sendToElectron(msg) {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(msg);
    const payload = Buffer.from(json, 'utf8');

    if (isWin) {
      const client = net.createConnection(PIPE_NAME, () => {
        client.write(payload, () => {
          client.end();
          resolve();
        });
      });
      client.on('error', reject);
      client.setTimeout(2000, () => {
        client.destroy();
        reject(new Error('timeout'));
      });
    } else {
      // Clean up stale socket file
      try { fs.unlinkSync(PIPE_UNIX); } catch {}
      const client = net.createConnection(PIPE_UNIX, () => {
        client.write(payload, () => {
          client.end();
          resolve();
        });
      });
      client.on('error', reject);
      client.setTimeout(2000, () => {
        client.destroy();
        reject(new Error('timeout'));
      });
    }
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const msg = await readMessage();
    if (msg && msg.type === 'url-detected' && msg.url) {
      await sendToElectron(msg);
    }
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

main();
