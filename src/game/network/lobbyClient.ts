import type { CombatantTeam, LobbyPlayer, RemotePlayerSnapshot, TacticalMapId, Vec3 } from '../types/game';

export interface NetworkLobby {
  code: string;
  teamSize: number;
  mapId: TacticalMapId;
  players: LobbyPlayer[];
  started: boolean;
  createdAt: number;
}

export interface NetworkMatchState {
  players: RemotePlayerSnapshot[];
  winnerName: string;
  winnerTeam: CombatantTeam | null;
  gameOver: boolean;
}

export interface CreateLobbyResponse {
  lobby: NetworkLobby;
  playerId: string;
}

const serverPort = 8787;

export const lobbyApiBase = (): string => {
  const params = new URLSearchParams(window.location.search);
  const override = params.get('server');
  if (override) {
    return override.replace(/\/$/, '');
  }

  return `http://${window.location.hostname}:${serverPort}`;
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${lobbyApiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? 'Network lobby request failed.');
  }

  return payload as T;
};

export const lobbyClient = {
  async status(): Promise<{ ok: boolean; port: number; addresses: string[] }> {
    return requestJson('/api/status');
  },
  async list(): Promise<{ lobbies: NetworkLobby[] }> {
    return requestJson('/api/lobbies');
  },
  async create(teamSize: number, name: string, mapId: TacticalMapId): Promise<CreateLobbyResponse> {
    return requestJson('/api/lobbies', {
      method: 'POST',
      body: JSON.stringify({ teamSize, name, mapId }),
    });
  },
  async join(code: string, team: CombatantTeam, name: string): Promise<CreateLobbyResponse> {
    return requestJson(`/api/lobbies/${code.trim().toUpperCase()}/join`, {
      method: 'POST',
      body: JSON.stringify({ team, name }),
    });
  },
  async get(code: string, playerId: string): Promise<{ lobby: NetworkLobby }> {
    return requestJson(`/api/lobbies/${code.trim().toUpperCase()}?playerId=${encodeURIComponent(playerId)}`);
  },
  async start(code: string, playerId: string): Promise<{ lobby: NetworkLobby }> {
    return requestJson(`/api/lobbies/${code.trim().toUpperCase()}/start`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
  },
  async updatePlayer(code: string, playerId: string, position: Vec3, yaw: number, pitch: number, health: number): Promise<{ match: NetworkMatchState }> {
    return requestJson(`/api/lobbies/${code.trim().toUpperCase()}/players/${playerId}`, {
      method: 'POST',
      body: JSON.stringify({ position, yaw, pitch, health }),
    });
  },
  async matchState(code: string, playerId: string): Promise<{ match: NetworkMatchState }> {
    return requestJson(`/api/lobbies/${code.trim().toUpperCase()}/match?playerId=${encodeURIComponent(playerId)}`);
  },
  async shoot(code: string, shooterId: string, targetId: string, damage: number): Promise<{ match: NetworkMatchState }> {
    return requestJson(`/api/lobbies/${code.trim().toUpperCase()}/shoot`, {
      method: 'POST',
      body: JSON.stringify({ shooterId, targetId, damage }),
    });
  },
  async restart(code: string, playerId: string): Promise<{ match: NetworkMatchState }> {
    return requestJson(`/api/lobbies/${code.trim().toUpperCase()}/restart`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
  },
};
