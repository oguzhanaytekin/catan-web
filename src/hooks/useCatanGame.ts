import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState } from '../game/gameState';
import { initialGameState } from '../game/gameState';
import type { ResourceType } from '../game/gameState';
import { io, Socket } from 'socket.io-client';

export function useCatanGame() {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [roomId, setRoomId] = useState<string>(''); 
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to the Node.js Socket.IO server utilizing VITE_API_URL for production (Render)
    const URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/');
    const socket = io(URL);
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('gameState', (newState: GameState) => setGameState(newState));

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoom = useCallback((room: string) => {
    setRoomId(room);
    if (socketRef.current) {
      socketRef.current.emit('joinRoom', room);
    }
  }, []);

  const dispatchAction = useCallback((type: string, payload?: any) => {
    if (socketRef.current && socketRef.current.connected && roomId !== 'lobby') {
      socketRef.current.emit('action', { roomId, type, payload });
    }
  }, [roomId]);

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
    gameState,
    diceResult,
    isConnected,
    roomId,
    joinRoom,
    actions: {
      rollDice,
      endTurn,
      buildRoad,
      buildSettlement,
      upgradeCity,
      buyDevCard,
      playKnight,
      moveRobber,
      tradeWithBank
    }
  };
}
