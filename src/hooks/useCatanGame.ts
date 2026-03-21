import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState, ResourceType } from '../game/gameState';
import { initialGameState } from '../game/gameState';
import { io, Socket } from 'socket.io-client';

export interface LobbyMember {
  username: string;
  color: string;
  isOwner: boolean;
  connected: boolean;
  isBot?: boolean;
  botDifficulty?: 'easy' | 'medium';
}

export interface LobbyState {
  roomName: string;
  members: LobbyMember[];
  started: boolean;
  takenColors: string[];
  takenUsernames: string[];
}

export interface RoomInfo {
  roomName: string;
  playerCount: number;
  hasPassword: boolean;
  started: boolean;
}

type AppPhase = 'AUTH' | 'LOGIN' | 'LOBBY' | 'GAME';

export function useCatanGame() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [phase, setPhase] = useState<AppPhase>('AUTH');
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [myPlayerId, setMyPlayerId] = useState('');
  const [myUsername, setMyUsername] = useState('');
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<{ username: string; timeoutMs: number } | null>(null);
  const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);
  const [roomList, setRoomList] = useState<RoomInfo[]>([]);
  const [reconnectRoom, setReconnectRoom] = useState<{roomName: string, started: boolean} | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/');
    const socket = io(URL);
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('authError', (msg: string) => {
      setAuthError(msg);
      setTimeout(() => setAuthError(null), 5000);
    });

    socket.on('authSuccess', ({ username, activeRoom, roomStarted }: any) => {
      setMyUsername(username);
      setIsAuthenticated(true);
      setPhase('LOGIN');
      setAuthError(null);
      if (activeRoom) {
        setReconnectRoom({ roomName: activeRoom, started: roomStarted });
      }
    });

    socket.on('lobbyError', (msg: string) => {
      setLobbyError(msg);
      setTimeout(() => setLobbyError(null), 5000);
    });

    socket.on('roomJoined', ({ roomName: rn, isOwner: owner }: { roomName: string; isOwner: boolean }) => {
      setRoomName(rn);
      setIsOwner(owner);
      setPhase('LOBBY');
      setLobbyError(null);
    });

    socket.on('lobbyUpdate', (data: LobbyState) => {
      setLobbyState(data);
    });

    socket.on('roomList', (list: RoomInfo[]) => {
      setRoomList(list);
    });

    socket.on('leftRoom', () => {
      setPhase('LOGIN');
      setRoomName('');
      setLobbyState(null);
      setGameState(initialGameState);
    });

    socket.on('gameStarted', (state: GameState) => {
      setGameState(state);
      setPhase('GAME');
    });

    socket.on('gameState', (newState: GameState) => {
      setGameState(newState);
    });

    socket.on('playerDisconnected', (data: { username: string; timeoutMs: number }) => {
      setDisconnectedPlayer(data);

      // Start countdown
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      let remaining = Math.ceil(data.timeoutMs / 1000);
      setDisconnectCountdown(remaining);

      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          setDisconnectCountdown(null);
        } else {
          setDisconnectCountdown(remaining);
        }
      }, 1000);

      // Clear everything after timeout + buffer
      setTimeout(() => {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setDisconnectedPlayer(null);
        setDisconnectCountdown(null);
      }, data.timeoutMs + 3000);
    });

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      socket.disconnect();
    };
  }, []);

  // Resolve myPlayerId once game starts (match by username)
  useEffect(() => {
    if (phase === 'GAME' && gameState.turnOrder.length > 0 && myUsername) {
      const foundId = gameState.turnOrder.find(pid => gameState.players[pid]?.name === myUsername);
      if (foundId) setMyPlayerId(foundId);
    }
  }, [phase, gameState, myUsername]);

  const register = useCallback((username: string, password: string) => {
    setAuthError(null);
    socketRef.current?.emit('register', { username, password });
  }, []);

  const login = useCallback((username: string, password: string) => {
    setAuthError(null);
    socketRef.current?.emit('login', { username, password });
  }, []);

  const createRoom = useCallback((roomName: string, password: string, color: string) => {
    setLobbyError(null);
    socketRef.current?.emit('createRoom', { roomName, password, color });
  }, []);

  const joinRoom = useCallback((roomName: string, password: string, color: string) => {
    setLobbyError(null);
    socketRef.current?.emit('joinRoom', { roomName, password, color });
  }, []);

  const startGame = useCallback(() => {
    if (roomName) {
      socketRef.current?.emit('startGame', { roomName });
    }
  }, [roomName]);

  const fetchRooms = useCallback(() => {
    socketRef.current?.emit('getRooms');
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('leaveRoom');
  }, []);

  const logout = useCallback(() => {
    socketRef.current?.disconnect();
    setTimeout(() => {
      socketRef.current?.connect();
      setPhase('AUTH');
      setIsAuthenticated(false);
      setMyUsername('');
    }, 100);
  }, []);

  const addBot = useCallback((difficulty: 'easy' | 'medium') => {
    if (roomName) {
      socketRef.current?.emit('addBot', { roomName, difficulty });
    }
  }, [roomName]);

  const dispatchAction = useCallback((type: string, payload?: any) => {
    if (socketRef.current?.connected && roomName) {
      socketRef.current.emit('action', { roomName, type, payload });
    }
  }, [roomName]);

  const rollDice = useCallback(() => dispatchAction('rollDice'), [dispatchAction]);
  const endTurn = useCallback(() => dispatchAction('endTurn'), [dispatchAction]);
  const buildRoad = useCallback((edgeId: string, playerId: string) => dispatchAction('buildRoad', { edgeId, playerId }), [dispatchAction]);
  const buildSettlement = useCallback((nodeId: string, playerId: string) => dispatchAction('buildSettlement', { nodeId, playerId }), [dispatchAction]);
  const upgradeCity = useCallback((nodeId: string, playerId: string) => dispatchAction('upgradeCity', { nodeId, playerId }), [dispatchAction]);
  const buyDevCard = useCallback((playerId: string) => dispatchAction('buyDevCard', { playerId }), [dispatchAction]);
  const playKnight = useCallback((playerId: string) => dispatchAction('playKnight', { playerId }), [dispatchAction]);
  const moveRobber = useCallback((hexId: string, stealFromId: string | null, playerId: string) => dispatchAction('moveRobber', { hexId, stealFromId, playerId }), [dispatchAction]);
  const tradeWithBank = useCallback((playerId: string, offer: ResourceType, ask: ResourceType) => dispatchAction('tradeWithBank', { playerId, offer, ask }), [dispatchAction]);

  const diceResult = gameState.diceState.rolled ? gameState.diceState.die1 + gameState.diceState.die2 : null;

  return {
    // State
    gameState,
    diceResult,
    isConnected,
    isAuthenticated,
    phase,
    isOwner,
    roomName,
    myPlayerId,
    myUsername,
    lobbyState,
    lobbyError,
    authError,
    disconnectedPlayer,
    disconnectCountdown,
    roomList,
    reconnectRoom,
    // Actions
    register,
    login,
    logout,
    createRoom,
    joinRoom,
    leaveRoom,
    fetchRooms,
    startGame,
    addBot,
    // Game Actions
    actions: {
      rollDice,
      endTurn,
      buildRoad,
      buildSettlement,
      upgradeCity,
      buyDevCard,
      playKnight,
      moveRobber,
      tradeWithBank,
    },
  };
}
