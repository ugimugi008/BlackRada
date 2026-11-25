import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import {
  assignRolesToPlayers,
  checkWinCondition,
  formatSeatNumber,
  getNextNightStep,
  getRecommendedRoleConfig,
  redactRoomForViewer,
  resolveNightOutcome,
  sanitizeNickname,
  tallyVotes,
  type ChatMessage,
  type GamePhase,
  type MafiaRole,
  type NightActions,
  type NightStep,
  type PlayerRecord,
  type RoleConfig,
  shuffleArray,
  type WinnerSide,
} from './src/shared/mafiaEngine.ts';
import { LOG_EN, formatLog, type LogEntry, type LogParams } from './src/shared/gameLog.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const LIVEKIT_URL = (process.env.LIVEKIT_URL || '').trim();
const LIVEKIT_API_KEY = (process.env.LIVEKIT_API_KEY || '').trim();
const LIVEKIT_API_SECRET = (process.env.LIVEKIT_API_SECRET || '').trim();

async function createLiveKitCredentials(
  roomCode: string,
  playerId: string,
  nickname: string
): Promise<{ url: string; token: string } | null> {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return null;
  }
  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: playerId,
      name: nickname,
      ttl: '6h',
    });
    at.addGrant({
      roomJoin: true,
      room: `mafia-${roomCode}`,
      canPublish: true,
      canSubscribe: true,
    });
    const token = await at.toJwt();
    return { url: LIVEKIT_URL, token };
  } catch {
    return null;
  }
}

interface RoomInternal {
  code: string;
  roomName: string;
  moderatorId: string;
  moderatorToken: string;
  moderatorOfflineSince: number | null;
  playerTokens: Map<string, string>; // playerId -> secret token
  playerSockets: Map<string, string>; // playerId -> socketId
  phase: GamePhase;
  nightNumber: number;
  dayNumber: number;
  nightStep: NightStep;
  roleConfig: RoleConfig;
  players: PlayerRecord[];
  votes: Record<string, string | 'SKIP'>;
  nightActions: NightActions;
  lastMorningSummary: LogEntry | null;
  winner: WinnerSide;
  timerSecondsLeft: number;
  timerRunning: boolean;
  messages: ChatMessage[];
  createdAt: number;
}

const rooms = new Map<string, RoomInternal>();
const socketIndex = new Map<string, { roomCode: string; playerId: string }>();

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += alphabet[bytes[i] % alphabet.length];
    }
    if (!rooms.has(code)) return code;
  }
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function createId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function createSecretToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

/** Adds a "Table" log line. Clients render `log` in their own language; `text` is the English fallback. */
/** Ack helper: a translatable entry plus its English text. */
function keyed(key: LogEntry['key'], params?: LogParams) {
  const entry: LogEntry = params ? { key, params } : { key };
  return { entry, text: formatLog(LOG_EN, entry) };
}

function addSystemMessage(room: RoomInternal, key: LogEntry['key'], params?: LogParams) {
  const log: LogEntry = params ? { key, params } : { key };
  room.messages.push({
    id: createId(),
    senderId: 'system',
    senderName: 'Table',
    text: formatLog(LOG_EN, log),
    timestamp: Date.now(),
    channel: 'system',
    log,
  });
  if (room.messages.length > 150) {
    room.messages = room.messages.slice(-150);
  }
}

function renumberSeats(room: RoomInternal) {
  let nextSeat = 1;
  room.players = room.players.map((p) => {
    if (p.isModerator) return { ...p, seatNumber: 0 };
    return { ...p, seatNumber: nextSeat++ };
  });
}

function isAuthorizedModerator(room: RoomInternal, playerId: string, token?: string): boolean {
  if (room.moderatorId !== playerId) return false;
  if (token && room.moderatorToken === token) return true;
  return true; // socketIndex already binds socket.id -> playerId
}

const MODERATOR_TAKEOVER_GRACE_MS = 15_000;

function resetTableToLobby(room: RoomInternal) {
  room.phase = 'LOBBY';
  room.nightNumber = 0;
  room.dayNumber = 0;
  room.nightStep = 'SLEEP';
  room.votes = {};
  room.nightActions = {
    mafiaTargetId: null,
    donCheckId: null,
    sheriffCheckId: null,
    doctorSaveId: null,
  };
  room.lastMorningSummary = null;
  room.winner = null;
  room.timerRunning = false;
  room.timerSecondsLeft = 90;
  room.players = room.players.map((p) => ({
    ...p,
    isAlive: true,
    role: null,
    modForceMuted: false,
    modForceCamHidden: false,
  }));
}

/**
 * Hands the Moderator role to a seated player. The previous Moderator takes
 * the new Moderator's seat, and the table goes back to Lobby with roles cleared
 * (a new Moderator must not inherit knowledge of an in-progress game).
 * Returns the new moderator token, or null if the target is invalid.
 */
function handOverModerator(room: RoomInternal, newModeratorId: string): string | null {
  const target = room.players.find((p) => p.id === newModeratorId && !p.isModerator);
  if (!target) return null;
  const oldModerator = room.players.find((p) => p.id === room.moderatorId) ?? null;

  const seated = room.players.filter((p) => !p.isModerator);
  const reordered = seated.map((p) => {
    if (p.id === target.id && oldModerator) return { ...oldModerator, isModerator: false };
    return p;
  });
  if (!oldModerator) {
    const idx = reordered.findIndex((p) => p.id === target.id);
    if (idx !== -1) reordered.splice(idx, 1);
  }
  const newModerator: PlayerRecord = { ...target, isModerator: true };
  room.players = [newModerator, ...reordered];

  room.moderatorId = newModerator.id;
  room.moderatorToken = createSecretToken();
  room.moderatorOfflineSince = newModerator.isConnected ? null : Date.now();
  resetTableToLobby(room);
  renumberSeats(room);
  room.roleConfig = getRecommendedRoleConfig(room.players.filter((p) => !p.isModerator).length);
  return room.moderatorToken;
}

function broadcastRoomState(io: SocketIOServer, room: RoomInternal) {
  for (const player of room.players) {
    const sid = room.playerSockets.get(player.id);
    if (!sid) continue;
    const targetSocket = io.sockets.sockets.get(sid);
    if (!targetSocket) continue;
    targetSocket.emit('room:state', redactRoomForViewer(room, player.id));
  }
}

function getConnectedPeerIds(room: RoomInternal, excludePlayerId: string): string[] {
  return room.players
    .filter((p) => p.id !== excludePlayerId && p.isConnected && room.playerSockets.has(p.id))
    .map((p) => p.id);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      activeRooms: rooms.size,
      sfuEnabled: Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET),
    });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = String(req.params.code || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ exists: false });
      return;
    }
    res.json({
      exists: true,
      code: room.code,
      roomName: room.roomName,
      playerCount: room.players.filter((p) => !p.isModerator).length,
      phase: room.phase,
    });
  });

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: false,
    },
    transports: ['websocket', 'polling'],
  });

  // Global 1-second timer tick for rooms with an active discussion timer
  setInterval(() => {
    for (const room of rooms.values()) {
      if (!room.timerRunning) continue;
      if (room.timerSecondsLeft > 0) {
        room.timerSecondsLeft -= 1;
        if (room.timerSecondsLeft === 0) {
          room.timerRunning = false;
          addSystemMessage(room, 'timerDone');
        }
        broadcastRoomState(io, room);
      } else {
        room.timerRunning = false;
      }
    }
  }, 1000);

  io.on('connection', (socket: Socket) => {
    socket.on(
      'room:create',
      async (
        payload: {
          nickname?: string;
          roomName?: string;
          micMuted?: boolean;
          camOff?: boolean;
        },
        ack?: (res: Record<string, unknown>) => void
      ) => {
        const nickname = sanitizeNickname(String(payload?.nickname || 'Moderator'), 'Moderator');
        const roomName = sanitizeNickname(String(payload?.roomName || 'Friday Night Mafia'), 'Mafia Table');
        const code = generateRoomCode();
        const playerId = createId();
        const playerToken = createSecretToken();
        const moderatorToken = createSecretToken();

        const moderator: PlayerRecord = {
          id: playerId,
          nickname,
          seatNumber: 0,
          isModerator: true,
          isAlive: true,
          isConnected: true,
          role: null,
          micMuted: Boolean(payload?.micMuted),
          camOff: Boolean(payload?.camOff),
          modForceMuted: false,
          modForceCamHidden: false,
        };

        const room: RoomInternal = {
          code,
          roomName,
          moderatorId: playerId,
          moderatorToken,
          moderatorOfflineSince: null,
          playerTokens: new Map([[playerId, playerToken]]),
          playerSockets: new Map([[playerId, socket.id]]),
          phase: 'LOBBY',
          nightNumber: 0,
          dayNumber: 0,
          nightStep: 'SLEEP',
          roleConfig: getRecommendedRoleConfig(6),
          players: [moderator],
          votes: {},
          nightActions: {
            mafiaTargetId: null,
            donCheckId: null,
            sheriffCheckId: null,
            doctorSaveId: null,
          },
          lastMorningSummary: null,
          winner: null,
          timerSecondsLeft: 90,
          timerRunning: false,
          messages: [],
          createdAt: Date.now(),
        };

        addSystemMessage(room, 'roomOpened', { name: nickname });
        rooms.set(code, room);
        socketIndex.set(socket.id, { roomCode: code, playerId });
        socket.join(code);

        const state = redactRoomForViewer(room, playerId);
        const livekit = await createLiveKitCredentials(code, playerId, nickname);
        ack?.({
          ok: true,
          code,
          playerId,
          playerToken,
          moderatorToken,
          state,
          peerIds: [],
          livekit,
        });
      }
    );

    socket.on(
      'room:join',
      async (
        payload: {
          code?: string;
          nickname?: string;
          micMuted?: boolean;
          camOff?: boolean;
          reconnectPlayerId?: string;
          reconnectToken?: string;
        },
        ack?: (res: Record<string, unknown>) => void
      ) => {
        const code = String(payload?.code || '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 8);
        const room = rooms.get(code);
        if (!room) {
          { const k = keyed('errRoomNotFound'); ack?.({ ok: false, error: k.text, errorEntry: k.entry }); }
          return;
        }

        // Check reconnect token first
        if (payload?.reconnectPlayerId && payload?.reconnectToken) {
          const expectedToken = room.playerTokens.get(payload.reconnectPlayerId);
          const existing = room.players.find((p) => p.id === payload.reconnectPlayerId);
          if (expectedToken && expectedToken === payload.reconnectToken && existing) {
            existing.isConnected = true;
            if (existing.isModerator) room.moderatorOfflineSince = null;
            existing.micMuted = Boolean(payload?.micMuted);
            existing.camOff = Boolean(payload?.camOff);
            room.playerSockets.set(existing.id, socket.id);
            socketIndex.set(socket.id, { roomCode: code, playerId: existing.id });
            socket.join(code);

            const peerIds = getConnectedPeerIds(room, existing.id);
            socket.to(code).emit('rtc:peerJoined', { playerId: existing.id });
            broadcastRoomState(io, room);
            const livekit = await createLiveKitCredentials(code, existing.id, existing.nickname);
            ack?.({
              ok: true,
              code,
              playerId: existing.id,
              playerToken: expectedToken,
              moderatorToken: existing.isModerator ? room.moderatorToken : undefined,
              state: redactRoomForViewer(room, existing.id),
              peerIds,
              livekit,
            });
            return;
          }
        }

        const seatedCount = room.players.filter((p) => !p.isModerator).length;
        if (seatedCount >= 20) {
          { const k = keyed('errRoomFull'); ack?.({ ok: false, error: k.text, errorEntry: k.entry }); }
          return;
        }

        const nickname = sanitizeNickname(
          String(payload?.nickname || `Player ${seatedCount + 1}`),
          `Player ${seatedCount + 1}`
        );
        const playerId = createId();
        const playerToken = createSecretToken();

        const newPlayer: PlayerRecord = {
          id: playerId,
          nickname,
          seatNumber: seatedCount + 1,
          isModerator: false,
          isAlive: room.phase === 'LOBBY',
          isConnected: true,
          role: null,
          micMuted: Boolean(payload?.micMuted),
          camOff: Boolean(payload?.camOff),
          modForceMuted: false,
          modForceCamHidden: false,
        };

        room.players.push(newPlayer);
        renumberSeats(room);
        if (room.phase === 'LOBBY') {
          room.roleConfig = getRecommendedRoleConfig(room.players.filter((p) => !p.isModerator).length);
        }
        room.playerTokens.set(playerId, playerToken);
        room.playerSockets.set(playerId, socket.id);
        socketIndex.set(socket.id, { roomCode: code, playerId });
        socket.join(code);

        addSystemMessage(room, 'tookSeat', { name: nickname, seat: formatSeatNumber(newPlayer.seatNumber) });
        const peerIds = getConnectedPeerIds(room, playerId);
        socket.to(code).emit('rtc:peerJoined', { playerId });
        broadcastRoomState(io, room);

        const livekit = await createLiveKitCredentials(code, playerId, nickname);
        ack?.({
          ok: true,
          code,
          playerId,
          playerToken,
          state: redactRoomForViewer(room, playerId),
          peerIds,
          livekit,
        });
      }
    );

    socket.on('player:mediaState', (payload: { micMuted?: boolean; camOff?: boolean }) => {
      const ctx = socketIndex.get(socket.id);
      if (!ctx) return;
      const room = rooms.get(ctx.roomCode);
      if (!room) return;
      const player = room.players.find((p) => p.id === ctx.playerId);
      if (!player) return;

      if (typeof payload?.micMuted === 'boolean') player.micMuted = payload.micMuted;
      if (typeof payload?.camOff === 'boolean') player.camOff = payload.camOff;
      broadcastRoomState(io, room);
    });

    socket.on('chat:send', (payload: { text?: string; channel?: 'public' | 'mafia' | 'dead' }) => {
      const ctx = socketIndex.get(socket.id);
      if (!ctx) return;
      const room = rooms.get(ctx.roomCode);
      if (!room) return;
      const player = room.players.find((p) => p.id === ctx.playerId);
      if (!player) return;

      const raw = String(payload?.text || '').replace(/[\r\n]+/g, ' ').trim();
      if (!raw) return;
      const text = raw.slice(0, 300);

      const requested = payload?.channel;
      let channel: 'public' | 'mafia' | 'dead' =
        requested === 'mafia' ? 'mafia' : requested === 'dead' ? 'dead' : 'public';
      const gameRunning = room.phase === 'NIGHT' || room.phase === 'DAY' || room.phase === 'VOTING';
      const inGraveyard = !player.isModerator && !player.isAlive && gameRunning;
      if (inGraveyard) {
        // The dead can only talk among themselves while the game runs.
        channel = 'dead';
      } else if (channel === 'dead') {
        if (!player.isModerator) channel = 'public';
      } else if (channel === 'mafia') {
        const allowed =
          player.isModerator || player.role === 'mafia' || player.role === 'don';
        if (!allowed) channel = 'public';
      }

      room.messages.push({
        id: createId(),
        senderId: player.id,
        senderName: player.isModerator
          ? `${player.nickname} (Mod)`
          : `${formatSeatNumber(player.seatNumber)} · ${player.nickname}`,
        text,
        timestamp: Date.now(),
        channel,
      });
      if (room.messages.length > 150) room.messages = room.messages.slice(-150);
      broadcastRoomState(io, room);
    });

    // WebRTC peer signaling relay (strictly within the same room)
    socket.on('rtc:signal', (payload: { targetPlayerId?: string; signal?: unknown }) => {
      const ctx = socketIndex.get(socket.id);
      if (!ctx) return;
      const room = rooms.get(ctx.roomCode);
      if (!room) return;
      const targetId = String(payload?.targetPlayerId || '');
      if (!targetId || targetId === ctx.playerId) return;

      const targetSid = room.playerSockets.get(targetId);
      if (!targetSid) return;
      io.to(targetSid).emit('rtc:signal', {
        fromPlayerId: ctx.playerId,
        signal: payload?.signal,
      });
    });

    // Moderator Controls
    const withModerator = (
      fn: (room: RoomInternal, mod: PlayerRecord, payload: Record<string, unknown>) => void
    ) => {
      return (payload: Record<string, unknown> = {}) => {
        const ctx = socketIndex.get(socket.id);
        if (!ctx) return;
        const room = rooms.get(ctx.roomCode);
        if (!room) return;
        const token = typeof payload?.moderatorToken === 'string' ? payload.moderatorToken : undefined;
        if (!isAuthorizedModerator(room, ctx.playerId, token)) return;
        const mod = room.players.find((p) => p.id === ctx.playerId);
        if (!mod) return;
        fn(room, mod, payload);
        broadcastRoomState(io, room);
      };
    };

    socket.on(
      'mod:renamePlayer',
      withModerator((room, _mod, payload) => {
        const targetId = String(payload.targetPlayerId || '');
        const target = room.players.find((p) => p.id === targetId);
        if (!target) return;
        const prevName = target.nickname;
        const nextName = sanitizeNickname(String(payload.nickname || ''), prevName);
        if (nextName === prevName) return;
        target.nickname = nextName;
        addSystemMessage(room, 'renamed', { prev: prevName, next: nextName });
      })
    );

    socket.on(
      'mod:moveSeat',
      withModerator((room, _mod, payload) => {
        const targetId = String(payload.targetPlayerId || '');
        const direction = payload.direction === 'up' ? 'up' : 'down';
        const seated = room.players.filter((p) => !p.isModerator);
        const modPlayer = room.players.find((p) => p.isModerator);
        const idx = seated.findIndex((p) => p.id === targetId);
        if (idx === -1) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= seated.length) return;
        [seated[idx], seated[swapIdx]] = [seated[swapIdx], seated[idx]];
        room.players = modPlayer ? [modPlayer, ...seated] : seated;
        renumberSeats(room);
      })
    );

    socket.on(
      'mod:setSeat',
      withModerator((room, _mod, payload) => {
        const targetId = String(payload.targetPlayerId || '');
        const seated = room.players.filter((p) => !p.isModerator);
        const modPlayer = room.players.find((p) => p.isModerator);
        const idx = seated.findIndex((p) => p.id === targetId);
        if (idx === -1) return;
        const wanted = Math.round(Number(payload.seatNumber));
        if (!Number.isFinite(wanted)) return;
        const newIdx = Math.max(0, Math.min(seated.length - 1, wanted - 1));
        if (newIdx === idx) return;
        const [target] = seated.splice(idx, 1);
        seated.splice(newIdx, 0, target);
        room.players = modPlayer ? [modPlayer, ...seated] : seated;
        renumberSeats(room);
        addSystemMessage(room, 'seatChanged', {
          name: target.nickname,
          seat: formatSeatNumber(newIdx + 1),
        });
      })
    );

    socket.on(
      'mod:shuffleSeats',
      withModerator((room) => {
        const seated = room.players.filter((p) => !p.isModerator);
        if (seated.length < 2) return;
        const modPlayer = room.players.find((p) => p.isModerator);
        room.players = modPlayer ? [modPlayer, ...shuffleArray(seated)] : shuffleArray(seated);
        renumberSeats(room);
        addSystemMessage(room, 'seatsShuffled');
      })
    );

    socket.on(
      'mod:kickPlayer',
      withModerator((room, _mod, payload) => {
        const targetId = String(payload.targetPlayerId || '');
        if (!targetId || targetId === room.moderatorId) return;
        const target = room.players.find((p) => p.id === targetId);
        if (!target) return;

        const targetSid = room.playerSockets.get(targetId);
        if (targetSid) {
          io.to(targetSid).emit('room:kicked', { reason: 'Removed by the Moderator.' });
          socketIndex.delete(targetSid);
          io.sockets.sockets.get(targetSid)?.leave(room.code);
        }

        room.players = room.players.filter((p) => p.id !== targetId);
        room.playerSockets.delete(targetId);
        room.playerTokens.delete(targetId);
        delete room.votes[targetId];
        renumberSeats(room);
        io.to(room.code).emit('rtc:peerLeft', { playerId: targetId });
        addSystemMessage(room, 'kicked', { name: target.nickname });
      })
    );

    socket.on(
      'mod:updateRoleConfig',
      withModerator((room, _mod, payload) => {
        const cfg = (payload.roleConfig || {}) as Partial<RoleConfig>;
        const mafiaCount = Math.max(0, Math.min(8, Number(cfg.mafiaCount ?? room.roleConfig.mafiaCount)));
        room.roleConfig = {
          mafiaCount,
          hasDon: Boolean(cfg.hasDon ?? room.roleConfig.hasDon),
          hasSheriff: Boolean(cfg.hasSheriff ?? room.roleConfig.hasSheriff),
          hasDoctor: Boolean(cfg.hasDoctor ?? room.roleConfig.hasDoctor),
        };
      })
    );

    socket.on(
      'mod:dealRoles',
      withModerator((room, _mod, payload) => {
        if (payload.mode === 'clear') {
          room.players = room.players.map((p) => ({ ...p, role: null, isAlive: true }));
          addSystemMessage(room, 'rolesCleared');
          return;
        }
        room.players = assignRolesToPlayers(room.players, room.roleConfig);
        room.winner = null;
        addSystemMessage(room, 'rolesDealt');
      })
    );

    socket.on(
      'mod:setPlayerRole',
      withModerator((room, _mod, payload) => {
        const targetId = String(payload.targetPlayerId || '');
        const role = payload.role as MafiaRole | null;
        const validRoles: Array<MafiaRole | null> = ['mafia', 'don', 'sheriff', 'doctor', 'villager', null];
        if (!validRoles.includes(role)) return;
        const target = room.players.find((p) => p.id === targetId && !p.isModerator);
        if (!target) return;
        target.role = role;
      })
    );

    socket.on(
      'mod:toggleAlive',
      withModerator((room, _mod, payload) => {
        const targetId = String(payload.targetPlayerId || '');
        const target = room.players.find((p) => p.id === targetId && !p.isModerator);
        if (!target) return;
        target.isAlive = !target.isAlive;
        addSystemMessage(room, target.isAlive ? 'markedAlive' : 'markedDead', {
          seat: formatSeatNumber(target.seatNumber),
          name: target.nickname,
        });
        if (room.phase !== 'LOBBY') {
          const w = checkWinCondition(room.players);
          if (w) {
            room.winner = w;
            room.phase = 'ENDED';
            room.timerRunning = false;
            addSystemMessage(room, 'teamWins', { team: w });
          }
        }
      })
    );

    socket.on(
      'mod:setMediaOverride',
      withModerator((room, _mod, payload) => {
        const targetId = String(payload.targetPlayerId || '');
        const target = room.players.find((p) => p.id === targetId && !p.isModerator);
        if (!target) return;
        if (typeof payload.modForceMuted === 'boolean') {
          target.modForceMuted = payload.modForceMuted;
        }
        if (typeof payload.modForceCamHidden === 'boolean') {
          target.modForceCamHidden = payload.modForceCamHidden;
        }
      })
    );

    socket.on(
      'mod:startNight',
      withModerator((room) => {
        // Ensure every seated player has at least villager if roles weren't dealt yet
        const anyRoleMissing = room.players.some((p) => !p.isModerator && p.role === null);
        if (anyRoleMissing) {
          room.players = assignRolesToPlayers(room.players, room.roleConfig);
        }
        room.phase = 'NIGHT';
        room.nightNumber += 1;
        room.nightStep = 'SLEEP';
        room.timerRunning = false;
        room.votes = {};
        room.winner = null;
        room.nightActions = {
          mafiaTargetId: null,
          donCheckId: null,
          sheriffCheckId: null,
          doctorSaveId: null,
        };
        addSystemMessage(room, 'nightBegins', { n: room.nightNumber });
      })
    );

    socket.on(
      'mod:setNightStep',
      withModerator((room, _mod, payload) => {
        if (room.phase !== 'NIGHT') return;
        const valid: NightStep[] = ['SLEEP', 'MAFIA', 'DON', 'SHERIFF', 'DOCTOR', 'RESOLVE'];
        const step = payload.step as NightStep;
        if (!valid.includes(step)) return;
        room.nightStep = step;
      })
    );

    socket.on(
      'mod:nextNightStep',
      withModerator((room) => {
        if (room.phase !== 'NIGHT') return;
        room.nightStep = getNextNightStep(room.nightStep, room.players);
      })
    );

    socket.on(
      'mod:setNightAction',
      withModerator((room, _mod, payload) => {
        if (room.phase !== 'NIGHT') return;
        const actionType = payload.actionType as 'mafia' | 'don' | 'sheriff' | 'doctor';
        const targetId = payload.targetPlayerId ? String(payload.targetPlayerId) : null;
        if (actionType === 'mafia') room.nightActions.mafiaTargetId = targetId;
        if (actionType === 'don') room.nightActions.donCheckId = targetId;
        if (actionType === 'sheriff') room.nightActions.sheriffCheckId = targetId;
        if (actionType === 'doctor') room.nightActions.doctorSaveId = targetId;
      })
    );

    socket.on(
      'mod:resolveNight',
      withModerator((room) => {
        if (room.phase !== 'NIGHT') return;
        const outcome = resolveNightOutcome(room.players, room.nightActions);
        if (outcome.eliminatedPlayerId) {
          const victim = room.players.find((p) => p.id === outcome.eliminatedPlayerId);
          if (victim) victim.isAlive = false;
        }
        room.dayNumber += 1;
        const morning: LogEntry = {
          key: outcome.summaryLog.key,
          params: { ...(outcome.summaryLog.params ?? {}), day: room.dayNumber },
        };
        room.lastMorningSummary = morning;
        room.votes = {};
        addSystemMessage(room, morning.key, morning.params);

        const winner = checkWinCondition(room.players);
        if (winner) {
          room.winner = winner;
          room.phase = 'ENDED';
          addSystemMessage(room, 'teamWins', { team: winner });
        } else {
          room.phase = 'DAY';
          room.timerSecondsLeft = 90;
          room.timerRunning = false;
        }
      })
    );

    socket.on(
      'mod:startDay',
      withModerator((room) => {
        room.phase = 'DAY';
        if (room.dayNumber === 0) room.dayNumber = 1;
        room.votes = {};
        addSystemMessage(room, 'dayOpened', { n: room.dayNumber });
      })
    );

    socket.on(
      'mod:startVoting',
      withModerator((room) => {
        room.phase = 'VOTING';
        room.votes = {};
        room.timerRunning = false;
        addSystemMessage(room, 'votingOpen');
      })
    );

    socket.on(
      'mod:resolveVoting',
      withModerator((room, _mod, payload) => {
        if (room.phase !== 'VOTING') return;
        const aliveIds = new Set(
          room.players.filter((p) => !p.isModerator && p.isAlive).map((p) => p.id)
        );
        const tally = tallyVotes(room.votes, aliveIds);
        const forcedId = typeof payload.forceEliminateId === 'string' ? payload.forceEliminateId : null;
        const skip = Boolean(payload.skip);

        const targetId = skip ? null : forcedId || tally.leaderId;
        if (targetId) {
          const victim = room.players.find((p) => p.id === targetId && !p.isModerator);
          if (victim) {
            victim.isAlive = false;
            const summary: LogEntry = {
              key: 'votedOut',
              params: { seat: formatSeatNumber(victim.seatNumber), name: victim.nickname },
            };
            room.lastMorningSummary = summary;
            addSystemMessage(room, summary.key, summary.params);
          }
        } else {
          room.lastMorningSummary = { key: 'noElimination' };
          addSystemMessage(room, 'noElimination');
        }

        room.votes = {};
        const winner = checkWinCondition(room.players);
        if (winner) {
          room.winner = winner;
          room.phase = 'ENDED';
          addSystemMessage(room, 'teamWins', { team: winner });
        } else {
          room.phase = 'DAY';
        }
      })
    );

    socket.on(
      'mod:endGame',
      withModerator((room, _mod, payload) => {
        const winner = payload.winner === 'MAFIA' || payload.winner === 'TOWN' ? payload.winner : null;
        room.winner = winner;
        room.phase = 'ENDED';
        room.timerRunning = false;
        addSystemMessage(room, 'roundEnded');
      })
    );

    socket.on(
      'mod:resetLobby',
      withModerator((room) => {
        resetTableToLobby(room);
        addSystemMessage(room, 'lobbyReset');
      })
    );

    const sendModeratorToken = (room: RoomInternal, token: string) => {
      const sid = room.playerSockets.get(room.moderatorId);
      if (sid) io.to(sid).emit('room:moderatorToken', { moderatorToken: token });
    };

    socket.on(
      'mod:transferModerator',
      withModerator((room, mod, payload) => {
        const targetId = String(payload.targetPlayerId || '');
        if (!targetId || targetId === mod.id) return;
        const targetName = room.players.find((p) => p.id === targetId)?.nickname;
        const token = handOverModerator(room, targetId);
        if (!token) return;
        sendModeratorToken(room, token);
        addSystemMessage(room, 'modPassed', { from: mod.nickname, to: targetName ?? '' });
      })
    );

    socket.on('room:claimModerator', (_payload: unknown, ack?: (res: Record<string, unknown>) => void) => {
      const ctx = socketIndex.get(socket.id);
      if (!ctx) return;
      const room = rooms.get(ctx.roomCode);
      if (!room) return;
      const claimant = room.players.find((p) => p.id === ctx.playerId);
      if (!claimant || claimant.isModerator) {
        { const k = keyed('errAlreadyModerator'); ack?.({ ok: false, error: k.text, errorEntry: k.entry }); }
        return;
      }
      const currentMod = room.players.find((p) => p.id === room.moderatorId);
      if (currentMod?.isConnected) {
        { const k = keyed('errModeratorBack'); ack?.({ ok: false, error: k.text, errorEntry: k.entry }); }
        return;
      }
      const offlineFor = Date.now() - (room.moderatorOfflineSince ?? 0);
      if (room.moderatorOfflineSince !== null && offlineFor < MODERATOR_TAKEOVER_GRACE_MS) {
        const wait = Math.ceil((MODERATOR_TAKEOVER_GRACE_MS - offlineFor) / 1000);
        ack?.({ ok: false, error: `The Moderator just dropped. Try again in ${wait}s.`, retryInSeconds: wait });
        return;
      }
      const token = handOverModerator(room, claimant.id);
      if (!token) {
        { const k = keyed('errTakeoverFailed'); ack?.({ ok: false, error: k.text, errorEntry: k.entry }); }
        return;
      }
      addSystemMessage(room, 'modTakeover', { to: claimant.nickname, from: currentMod?.nickname ?? '—' });
      broadcastRoomState(io, room);
      ack?.({ ok: true, moderatorToken: token });
    });

    socket.on(
      'mod:timerControl',
      withModerator((room, _mod, payload) => {
        const action = String(payload.action || '');
        if (action === 'start') {
          if (room.timerSecondsLeft <= 0) room.timerSecondsLeft = 90;
          room.timerRunning = true;
        } else if (action === 'pause') {
          room.timerRunning = false;
        } else if (action === 'set') {
          const secs = Math.max(10, Math.min(600, Number(payload.seconds || 90)));
          room.timerSecondsLeft = secs;
          room.timerRunning = false;
        }
      })
    );

    // Player Actions
    socket.on('game:castVote', (payload: { targetPlayerId?: string }) => {
      const ctx = socketIndex.get(socket.id);
      if (!ctx) return;
      const room = rooms.get(ctx.roomCode);
      if (!room || room.phase !== 'VOTING') return;
      const voter = room.players.find((p) => p.id === ctx.playerId);
      if (!voter || voter.isModerator || !voter.isAlive) return;

      const targetId = String(payload?.targetPlayerId || '');
      if (targetId === 'SKIP') {
        room.votes[voter.id] = 'SKIP';
      } else {
        const target = room.players.find((p) => p.id === targetId && !p.isModerator && p.isAlive);
        if (!target) return;
        room.votes[voter.id] = target.id;
      }
      broadcastRoomState(io, room);
    });

    socket.on(
      'game:nightAction',
      (
        payload: { actionType?: 'mafia' | 'don' | 'sheriff' | 'doctor'; targetPlayerId?: string },
        ack?: (res: Record<string, unknown>) => void
      ) => {
        const ctx = socketIndex.get(socket.id);
        if (!ctx) return;
        const room = rooms.get(ctx.roomCode);
        if (!room || room.phase !== 'NIGHT') return;
        const actor = room.players.find((p) => p.id === ctx.playerId);
        if (!actor || actor.isModerator || !actor.isAlive) return;

        const targetId = String(payload?.targetPlayerId || '');
        const target = room.players.find((p) => p.id === targetId && !p.isModerator && p.isAlive);
        if (!target) return;

        const actionType = payload?.actionType;
        if (actionType === 'mafia' && room.nightStep === 'MAFIA' && (actor.role === 'mafia' || actor.role === 'don')) {
          room.nightActions.mafiaTargetId = target.id;
          broadcastRoomState(io, room);
          { const k = keyed('fbMarked', { name: target.nickname }); ack?.({ ok: true, message: k.text, messageEntry: k.entry }); }
          return;
        }
        if (actionType === 'don' && room.nightStep === 'DON' && actor.role === 'don') {
          room.nightActions.donCheckId = target.id;
          const isSheriff = target.role === 'sheriff';
          broadcastRoomState(io, room);
          ack?.({
            ok: true,
            result: isSheriff ? 'SHERIFF' : 'NOT_SHERIFF',
            ...(() => {
              const k = keyed(isSheriff ? 'fbIsSheriff' : 'fbNotSheriff', { name: target.nickname });
              return { message: k.text, messageEntry: k.entry };
            })(),
          });
          return;
        }
        if (actionType === 'sheriff' && room.nightStep === 'SHERIFF' && actor.role === 'sheriff') {
          room.nightActions.sheriffCheckId = target.id;
          const isMafia = target.role === 'mafia' || target.role === 'don';
          broadcastRoomState(io, room);
          ack?.({
            ok: true,
            result: isMafia ? 'MAFIA' : 'TOWN',
            ...(() => {
              const k = keyed(isMafia ? 'fbIsMafia' : 'fbIsTown', { name: target.nickname });
              return { message: k.text, messageEntry: k.entry };
            })(),
          });
          return;
        }
        if (actionType === 'doctor' && room.nightStep === 'DOCTOR' && actor.role === 'doctor') {
          room.nightActions.doctorSaveId = target.id;
          broadcastRoomState(io, room);
          { const k = keyed('fbProtecting', { name: target.nickname }); ack?.({ ok: true, message: k.text, messageEntry: k.entry }); }
          return;
        }

        { const k = keyed('fbNotAllowed'); ack?.({ ok: false, error: k.text, errorEntry: k.entry }); }
      }
    );

    const handleDisconnect = (explicitLeave: boolean) => {
      const ctx = socketIndex.get(socket.id);
      if (!ctx) return;
      socketIndex.delete(socket.id);
      const room = rooms.get(ctx.roomCode);
      if (!room) return;

      const player = room.players.find((p) => p.id === ctx.playerId);
      if (!player) return;

      if (explicitLeave && !player.isModerator) {
        room.players = room.players.filter((p) => p.id !== player.id);
        room.playerSockets.delete(player.id);
        room.playerTokens.delete(player.id);
        renumberSeats(room);
        io.to(room.code).emit('rtc:peerLeft', { playerId: player.id });
        addSystemMessage(room, 'left', { name: player.nickname });
        broadcastRoomState(io, room);
      } else {
        player.isConnected = false;
        if (player.isModerator) room.moderatorOfflineSince = Date.now();
        room.playerSockets.delete(player.id);
        io.to(room.code).emit('rtc:peerLeft', { playerId: player.id });
        broadcastRoomState(io, room);
      }

      // Clean up completely empty rooms after disconnect if everyone is gone
      const anyConnected = room.players.some((p) => p.isConnected);
      if (!anyConnected) {
        setTimeout(() => {
          const check = rooms.get(room.code);
          if (check && !check.players.some((p) => p.isConnected)) {
            rooms.delete(room.code);
          }
        }, 120_000);
      }
    };

    socket.on('room:leave', () => handleDisconnect(true));
    socket.on('disconnect', () => handleDisconnect(false));
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Black Rada server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
