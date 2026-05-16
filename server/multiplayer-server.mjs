import http from 'node:http';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.BENG_BENG_PORT ?? 8787);
const lobbies = new Map();

const maxTeamSize = 5;
const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const defaultMapId = 'deathmatch1';
const mapIds = new Set(['deathmatch1', 'dockyard', 'rooftop']);
const mapSpawns = {
  deathmatch1: {
    friendly: [
      { x: -8, y: 1.8, z: 25 },
      { x: -4, y: 1.8, z: 25.5 },
      { x: 0, y: 1.8, z: 26 },
      { x: 4, y: 1.8, z: 25.5 },
      { x: 8, y: 1.8, z: 25 },
    ],
    enemy: [
      { x: -9, y: 1.8, z: -25 },
      { x: 0, y: 1.8, z: -27 },
      { x: 9, y: 1.8, z: -25 },
      { x: -14, y: 1.8, z: -18 },
      { x: 14, y: 1.8, z: -18 },
    ],
  },
  dockyard: {
    friendly: [
      { x: -12, y: 1.8, z: 25 },
      { x: -6, y: 1.8, z: 26 },
      { x: 0, y: 1.8, z: 25.2 },
      { x: 6, y: 1.8, z: 26 },
      { x: 12, y: 1.8, z: 25 },
    ],
    enemy: [
      { x: -12, y: 1.8, z: -25 },
      { x: -6, y: 1.8, z: -26 },
      { x: 0, y: 1.8, z: -25.2 },
      { x: 6, y: 1.8, z: -26 },
      { x: 12, y: 1.8, z: -25 },
    ],
  },
  rooftop: {
    friendly: [
      { x: -10, y: 1.8, z: 24 },
      { x: -5, y: 1.8, z: 26 },
      { x: 0, y: 1.8, z: 24 },
      { x: 5, y: 1.8, z: 26 },
      { x: 10, y: 1.8, z: 24 },
    ],
    enemy: [
      { x: -10, y: 1.8, z: -24 },
      { x: -5, y: 1.8, z: -26 },
      { x: 0, y: 1.8, z: -24 },
      { x: 5, y: 1.8, z: -26 },
      { x: 10, y: 1.8, z: -24 },
    ],
  },
};

const normalizeMapId = (mapId) => mapIds.has(mapId) ? mapId : defaultMapId;

const createCode = () => {
  let code = '';
  for (let index = 0; index < 5; index += 1) {
    code += codeAlphabet[Math.floor(Math.random() * codeAlphabet.length)];
  }
  return lobbies.has(code) ? createCode() : code;
};

const createPlayer = ({ name, team, isHost = false }) => ({
  id: randomUUID(),
  name: String(name || 'Player').slice(0, 18),
  team,
  isHost,
  isLocal: false,
  ready: true,
  health: 100,
  alive: true,
  position: team === 'friendly' ? { x: -8, y: 1.8, z: 25 } : { x: -9, y: 1.8, z: -25 },
  yaw: team === 'friendly' ? Math.PI : 0,
  pitch: 0,
  isCrouching: false,
  isJumping: false,
  lastSeenAt: Date.now(),
});

const playerSnapshot = (player) => ({
  id: player.id,
  name: player.name,
  team: player.team,
  health: player.health,
  position: player.position,
  yaw: player.yaw,
  pitch: player.pitch,
  alive: player.alive,
  isHost: player.isHost,
  isCrouching: Boolean(player.isCrouching),
  isJumping: Boolean(player.isJumping),
});

const matchState = (lobby) => ({
  players: lobby.players.map(playerSnapshot),
  winnerName: lobby.winnerName,
  winnerTeam: lobby.winnerTeam,
  gameOver: Boolean(lobby.winnerTeam),
});

const resetMatch = (lobby) => {
  const spawns = mapSpawns[normalizeMapId(lobby.mapId)];
  lobby.started = true;
  lobby.winnerName = '';
  lobby.winnerTeam = null;
  lobby.players.forEach((player) => {
    const teamIndex = lobby.players.filter((candidate) => candidate.team === player.team).indexOf(player);
    const start = spawns[player.team][teamIndex] ?? spawns[player.team][0];
    player.health = 100;
    player.alive = true;
    player.position = { ...start };
    player.yaw = player.team === 'friendly' ? Math.PI : 0;
    player.pitch = 0;
    player.lastSeenAt = Date.now();
  });
};

const readJson = (request) =>
  new Promise((resolve) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });

const sendJson = (response, status, payload) => {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(payload));
};

const publicLobby = (lobby) => ({
  code: lobby.code,
  teamSize: lobby.teamSize,
  mapId: normalizeMapId(lobby.mapId),
  players: lobby.players,
  started: lobby.started,
  createdAt: lobby.createdAt,
});

const getLanAddresses = () => Object.values(os.networkInterfaces())
  .flat()
  .filter((network) => network && network.family === 'IPv4' && !network.internal)
  .map((network) => network.address);

const route = async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);

  if (request.method === 'GET' && url.pathname === '/api/status') {
    sendJson(response, 200, {
      ok: true,
      port: PORT,
      addresses: getLanAddresses(),
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/lobbies') {
    sendJson(response, 200, {
      lobbies: Array.from(lobbies.values())
        .filter((lobby) => !lobby.started)
        .map(publicLobby),
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/lobbies') {
    const body = await readJson(request);
    const teamSize = Math.max(1, Math.min(maxTeamSize, Math.round(Number(body.teamSize) || maxTeamSize)));
    const mapId = normalizeMapId(body.mapId);
    const code = createCode();
    const host = createPlayer({ name: body.name || 'Host', team: 'friendly', isHost: true });
    const lobby = {
      code,
      teamSize,
      mapId,
      players: [host],
      started: false,
      winnerName: '',
      winnerTeam: null,
      createdAt: Date.now(),
    };
    lobbies.set(code, lobby);
    sendJson(response, 201, { lobby: publicLobby(lobby), playerId: host.id });
    return;
  }

  if (parts[0] === 'api' && parts[1] === 'lobbies' && parts[2]) {
    const code = parts[2].toUpperCase();
    const lobby = lobbies.get(code);

    if (!lobby) {
      sendJson(response, 404, { error: 'Lobby not found.' });
      return;
    }

    if (request.method === 'GET' && parts.length === 3) {
      const playerId = url.searchParams.get('playerId');
      const player = lobby.players.find((candidate) => candidate.id === playerId);
      if (player) {
        player.lastSeenAt = Date.now();
      }
      sendJson(response, 200, { lobby: publicLobby(lobby) });
      return;
    }

    if (request.method === 'POST' && parts[3] === 'join') {
      if (lobby.started) {
        sendJson(response, 409, { error: 'Lobby already started.' });
        return;
      }

      const body = await readJson(request);
      const team = body.team === 'enemy' ? 'enemy' : 'friendly';
      const teamCount = lobby.players.filter((player) => player.team === team).length;
      if (teamCount >= lobby.teamSize) {
        sendJson(response, 409, { error: 'That team is full.' });
        return;
      }

      const player = createPlayer({ name: body.name || 'Player', team });
      lobby.players.push(player);
      sendJson(response, 200, { lobby: publicLobby(lobby), playerId: player.id });
      return;
    }

    if (request.method === 'POST' && parts[3] === 'start') {
      const body = await readJson(request);
      const host = lobby.players.find((player) => player.id === body.playerId && player.isHost);
      const friendlyCount = lobby.players.filter((player) => player.team === 'friendly').length;
      const enemyCount = lobby.players.filter((player) => player.team === 'enemy').length;
      if (!host) {
        sendJson(response, 403, { error: 'Only the host can start.' });
        return;
      }

      if (friendlyCount !== lobby.teamSize || enemyCount !== lobby.teamSize) {
        sendJson(response, 409, { error: 'Lobby is not full yet.' });
        return;
      }

      resetMatch(lobby);
      sendJson(response, 200, { lobby: publicLobby(lobby) });
      return;
    }

    if (request.method === 'POST' && parts[3] === 'restart') {
      const body = await readJson(request);
      const player = lobby.players.find((candidate) => candidate.id === body.playerId);
      if (!player) {
        sendJson(response, 403, { error: 'Only lobby players can restart.' });
        return;
      }

      resetMatch(lobby);
      sendJson(response, 200, { match: matchState(lobby) });
      return;
    }

    if (request.method === 'GET' && parts[3] === 'match') {
      const playerId = url.searchParams.get('playerId');
      const player = lobby.players.find((candidate) => candidate.id === playerId);
      if (player) {
        player.lastSeenAt = Date.now();
      }
      sendJson(response, 200, { match: matchState(lobby) });
      return;
    }

    if (request.method === 'POST' && parts[3] === 'players' && parts[4]) {
      const player = lobby.players.find((candidate) => candidate.id === parts[4]);
      if (!player) {
        sendJson(response, 404, { error: 'Player not found.' });
        return;
      }

      const body = await readJson(request);
      player.position = {
        x: Number.isFinite(Number(body.position?.x)) ? Number(body.position.x) : player.position.x,
        y: Number.isFinite(Number(body.position?.y)) ? Number(body.position.y) : player.position.y,
        z: Number.isFinite(Number(body.position?.z)) ? Number(body.position.z) : player.position.z,
      };
      player.yaw = Number.isFinite(Number(body.yaw)) ? Number(body.yaw) : player.yaw;
      player.pitch = Number.isFinite(Number(body.pitch)) ? Number(body.pitch) : player.pitch;
      player.isCrouching = Boolean(body.isCrouching);
      player.isJumping = Boolean(body.isJumping);
      player.lastSeenAt = Date.now();
      sendJson(response, 200, { match: matchState(lobby) });
      return;
    }

    if (request.method === 'POST' && parts[3] === 'shoot') {
      const body = await readJson(request);
      const shooter = lobby.players.find((player) => player.id === body.shooterId);
      const target = lobby.players.find((player) => player.id === body.targetId);
      if (!shooter || !target) {
        sendJson(response, 404, { error: 'Player not found.' });
        return;
      }

      if (!lobby.winnerTeam && shooter.team !== target.team && shooter.alive && target.alive) {
        const damage = Math.max(1, Math.min(45, Math.round(Number(body.damage) || 1)));
        target.health = Math.max(0, target.health - damage);
        target.alive = target.health > 0;

        if (!target.alive) {
          lobby.winnerName = shooter.name;
          lobby.winnerTeam = shooter.team;
        }
      }

      sendJson(response, 200, { match: matchState(lobby) });
      return;
    }
  }

  sendJson(response, 404, { error: 'Not found.' });
};

const server = http.createServer((request, response) => {
  route(request, response).catch((error) => {
    sendJson(response, 500, { error: error instanceof Error ? error.message : 'Server error.' });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const addresses = getLanAddresses();
  console.log(`Beng Beng multiplayer server listening on port ${PORT}`);
  addresses.forEach((address) => {
    console.log(`LAN API: http://${address}:${PORT}`);
  });
});
