import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState, ResourceType } from '../game/gameState';
import { initialGameState } from '../game/gameState';
import { io, Socket } from 'socket.io-client';

export interface LobbyMember {
  username: string;
  color: string;
  isOwner: boolean;
}

export interface LobbyState {
  roomName: string;
  members: LobbyMember[];
  started: boolean;
  takenColors: string[];
  takenUsernames: string[];
}

type AppPhase = 'LOGIN' | 'LOBBY' | 'GAME';

export function useCatanGame() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [phase, setPhase] = useState<AppPhase>('LOGIN');
  const [isConnected, setIsConnected] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [myPlayerId, setMyPlayerId] = useState('');
  const [myUsername, setMyUsername] = useState('');
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/');
    const socket = io(URL);
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('lobbyError', (msg: string) => {
      setLobbyError(msg);
      // Auto-clear error after 5 seconds
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

    socket.on('gameStarted', (state: GameState) => {
      setGameState(state);
      setPhase('GAME');
    });

    socket.on('gameState', (newState: GameState) => {
      setGameState(newState);
    });

    return () => {
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

  const createRoom = useCallback((roomName: string, password: string, username: string, color: string) => {
    setMyUsername(username);
    setLobbyError(null);
    socketRef.current?.emit('createRoom', { roomName, password, username, color });
  }, []);

  const joinRoom = useCallback((roomName: string, password: string, username: string, color: string) => {
    setMyUsername(username);
    setLobbyError(null);
    socketRef.current?.emit('joinRoom', { roomName, password, username, color });
  }, []);

  const startGame = useCallback(() => {
    if (roomName) {
      socketRef.current?.emit('startGame', { roomName });
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
    phase,
    isOwner,
    roomName,
    myPlayerId,
    myUsername,
    lobbyState,
    lobbyError,
    // Lobby Actions
    createRoom,
    joinRoom,
    startGame,
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
