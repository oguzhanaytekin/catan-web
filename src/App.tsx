import { useState, useRef } from 'react';
import './index.css';
import { HexGrid } from './components/HexGrid';
import { PlayerPanel } from './components/PlayerPanel';
import { useCatanGame } from './hooks/useCatanGame';
import type { ResourceType } from './game/gameState';
import { animated, useSpring } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';

const COLOR_MAP: Record<string, { label: string; hex: string; emoji: string }> = {
  red:    { label: 'Kırmızı', hex: '#ef4444', emoji: '🔴' },
  blue:   { label: 'Mavi',    hex: '#3b82f6', emoji: '🔵' },
  white:  { label: 'Beyaz',   hex: '#f8fafc', emoji: '⚪' },
  orange: { label: 'Turuncu', hex: '#f97316', emoji: '🟠' },
};

function App() {
  const {
    gameState, diceResult, isConnected, phase, isOwner,
    roomName, myPlayerId, myUsername, lobbyState, lobbyError, authError, disconnectedPlayer,
    roomList, reconnectRoom,
    register, login, logout, createRoom, joinRoom, leaveRoom, fetchRooms, startGame, actions
  } = useCatanGame();

  // ─── Auth State ────────────────────────────────────
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  // ─── Login / Lobby Form State ──────────────────────
  const [lobbyMode, setLobbyMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [formRoomName, setFormRoomName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  // ─── Mobile UI State ────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // ─── Game UI State ─────────────────────────────────
  const [buildingMode, setBuildingMode] = useState<'road' | 'settlement' | 'city' | null>(null);
  const [tradeMode, setTradeMode] = useState<boolean>(false);
  const [tradeOffer, setTradeOffer] = useState<ResourceType | null>(null);

  // ─── 3D Camera ─────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [{ x, y, scale, rotateZ, rotateX }, api] = useSpring(() => ({
    x: 0, y: 0, scale: 1, rotateZ: 0, rotateX: 60,
    config: { mass: 1, tension: 280, friction: 60 }
  }));

  useGesture({
    onDrag: ({ offset: [dx, dy], buttons }: any) => {
      if (buttons === 2 || (buttons === 0 && dx !== 0)) { // Right click or touch drag
        api.start({ rotateZ: -45 + dx * 0.5, rotateX: Math.max(0, Math.min(80, 60 - dy * 0.5)) });
      } else {
        api.start({ x: dx, y: dy });
      }
    },
    onWheel: ({ event, delta: [, dy] }: any) => {
      event.preventDefault();
      api.start({ scale: Math.max(0.3, Math.min(3, scale.get() - dy * 0.005)) });
    },
    onPinch: ({ offset: [d] }: any) => {
      api.start({ scale: Math.max(0.3, Math.min(3, d)) });
    }
  }, {
    target: containerRef,
    eventOptions: { passive: false },
    drag: { from: () => [x.get(), y.get()], filterTaps: true },
    pinch: { from: () => [scale.get(), 0] }
  });

  // ═══════════════════════════════════════════════════
  // AUTH PHASE — Login / Register
  // ═══════════════════════════════════════════════════
  if (phase === 'AUTH') {
    return (
      <div style={{ padding: '24px', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h1 style={{ textAlign: 'center', margin: 0, fontSize: '2.5rem', fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,0.5)', letterSpacing: '3px' }}>CATAN</h1>
          
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px' }}>
            <button 
              className="glass-btn" 
              style={{ flex: 1, background: authMode === 'login' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none' }}
              onClick={() => setAuthMode('login')}
            >Giriş Yap</button>
            <button 
              className="glass-btn" 
              style={{ flex: 1, background: authMode === 'register' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none' }}
              onClick={() => setAuthMode('register')}
            >Kayıt Ol</button>
          </div>

          {authError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.25)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '0.9rem', textAlign: 'center' }}>
              ⚠️ {authError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kullanıcı Adı</label>
              <input
                type="text"
                placeholder="Kullanıcı adı..."
                value={authUsername}
                onChange={e => setAuthUsername(e.target.value)}
                style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Şifre</label>
              <input
                type="password"
                placeholder="Şifre..."
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
              />
            </div>
            
            <button 
              className="glass-btn" 
              style={{ marginTop: '10px', background: 'rgba(34, 197, 94, 0.3)', padding: '14px' }}
              onClick={() => authMode === 'login' ? login(authUsername, authPassword) : register(authUsername, authPassword)}
              disabled={!authUsername || !authPassword}
            >
              {authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // LOGIN PHASE — Username + Create/Join Room
  // ═══════════════════════════════════════════════════
  if (phase === 'LOGIN') {
    const takenColors = lobbyState?.takenColors || [];

    return (
      <div style={{ padding: '24px', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ width: '420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Title */}
          <h1 style={{ textAlign: 'center', margin: 0, fontSize: '2.5rem', fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,0.5)', letterSpacing: '3px' }}>CATAN</h1>
          <p style={{ textAlign: 'center', color: isConnected ? '#4ade80' : '#f87171', margin: 0, fontSize: '0.85rem' }}>
            {isConnected ? '🟢 Sunucuya Bağlı' : '🔴 Bağlanıyor...'}
          </p>

          {/* Error Banner */}
          {lobbyError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.25)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '0.9rem', textAlign: 'center' }}>
              ⚠️ {lobbyError}
            </div>
          )}

          {/* Welcome User */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '1rem', color: '#fbbf24' }}>
              Hoş geldin, <strong>{myUsername}</strong>!
            </p>
            <button className="glass-btn" onClick={logout} style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.2)' }}>🚪 Çıkış</button>
          </div>

          {/* Mode Choice */}
          {lobbyMode === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              {reconnectRoom && (
                <button
                  className="glass-btn"
                  onClick={() => joinRoom(reconnectRoom.roomName, '', 'red')}
                  style={{ padding: '14px', fontSize: '1rem', background: 'rgba(234, 179, 8, 0.25)', border: '1px solid rgba(234, 179, 8, 0.5)' }}
                >
                  ⚡ Odaya Geri Dön ({reconnectRoom.roomName})
                </button>
              )}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="glass-btn"
                  onClick={() => setLobbyMode('create')}
                  disabled={!isConnected || !myUsername.trim()}
                  style={{ flex: 1, padding: '14px', fontSize: '1rem', background: myUsername.trim() && isConnected ? 'rgba(34, 197, 94, 0.25)' : undefined, border: '1px solid rgba(34, 197, 94, 0.5)' }}
                >
                  🏠 Oda Kur
                </button>
                <button
                  className="glass-btn"
                  onClick={() => { setLobbyMode('join'); fetchRooms(); }}
                  disabled={!isConnected || !myUsername.trim()}
                  style={{ flex: 1, padding: '14px', fontSize: '1rem', background: myUsername.trim() && isConnected ? 'rgba(59, 130, 246, 0.25)' : undefined, border: '1px solid rgba(59, 130, 246, 0.5)' }}
                >
                  🚪 Katıl
                </button>
              </div>
            </div>
          )}

          {/* Create Room Form */}
          {lobbyMode === 'create' && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#4ade80', fontWeight: 600 }}>🏠 Yeni Oda Oluştur</p>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Oda Adı:</label>
                <input
                  type="text"
                  placeholder="Oda adını belirle..."
                  value={formRoomName}
                  onChange={e => setFormRoomName(e.target.value)}
                  maxLength={20}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '1rem', textAlign: 'center', marginTop: '4px', boxSizing: 'border-box' }}
                />
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px', display: 'block' }}>Oda Şifresi:</label>
                <input
                  type="password"
                  placeholder="Şifre belirle..."
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  maxLength={20}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '1rem', textAlign: 'center', marginTop: '4px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Color Selection */}
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Renk Seçimi:</label>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {Object.entries(COLOR_MAP).map(([key, { hex }]) => {
                  const taken = takenColors.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => !taken && setSelectedColor(key)}
                      disabled={taken}
                      title={taken ? 'Bu renk alındı' : COLOR_MAP[key].label}
                      style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        backgroundColor: hex,
                        border: selectedColor === key ? '4px solid #fbbf24' : '2px solid rgba(255,255,255,0.2)',
                        cursor: taken ? 'not-allowed' : 'pointer',
                        opacity: taken ? 0.25 : 1,
                        transform: selectedColor === key ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.2s',
                        position: 'relative',
                      }}
                    >
                      {taken && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: '1.2rem' }}>✕</span>}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button className="glass-btn" onClick={() => setLobbyMode('choose')} style={{ flex: 1, padding: '10px' }}>← Geri</button>
                <button
                  className="glass-btn"
                  onClick={() => {
                    if (formRoomName.trim() && formPassword.trim() && selectedColor) {
                      createRoom(formRoomName.trim(), formPassword.trim(), selectedColor);
                    }
                  }}
                  disabled={!myUsername.trim() || !formRoomName.trim() || !formPassword.trim() || !selectedColor}
                  style={{ flex: 2, padding: '10px', background: 'rgba(34, 197, 94, 0.3)', fontSize: '1rem' }}
                >
                  Odayı Kur ✓
                </button>
              </div>
            </>
          )}

          {/* Join Room Form */}
          {lobbyMode === 'join' && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#60a5fa', fontWeight: 600 }}>🚪 Odaya Katıl</p>
                  <button className="glass-btn" onClick={fetchRooms} style={{ padding: '4px 8px', fontSize: '0.7rem' }}>🔄 Yenile</button>
                </div>

                <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px' }}>
                  {roomList.length > 0 ? roomList.filter(r => !r.started).map(r => (
                    <div key={r.roomName} onClick={() => { setFormRoomName(r.roomName); if(!r.hasPassword) setFormPassword(''); }}
                         style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: formRoomName === r.roomName ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)', borderRadius: '4px', cursor: 'pointer', border: formRoomName === r.roomName ? '1px solid #60a5fa' : '1px solid transparent' }}>
                      <span style={{ fontWeight: 'bold' }}>{r.roomName}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>👤 {r.playerCount}/4 {r.hasPassword ? '🔒' : '🔓'}</span>
                    </div>
                  )) : (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>Aktif oda bulunamadı.</p>
                  )}
                </div>

                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Oda Adı:</label>
                <input
                  type="text"
                  placeholder="Oda adını gir..."
                  value={formRoomName}
                  onChange={e => setFormRoomName(e.target.value)}
                  maxLength={20}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '1rem', textAlign: 'center', marginTop: '4px', boxSizing: 'border-box' }}
                />
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px', display: 'block' }}>Oda Şifresi:</label>
                <input
                  type="password"
                  placeholder="Şifreyi gir..."
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  maxLength={20}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '1rem', textAlign: 'center', marginTop: '4px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Color Selection */}
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Renk Seçimi:</label>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {Object.entries(COLOR_MAP).map(([key, { hex }]) => {
                  const taken = takenColors.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => !taken && setSelectedColor(key)}
                      disabled={taken}
                      title={taken ? 'Bu renk alındı' : COLOR_MAP[key].label}
                      style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        backgroundColor: hex,
                        border: selectedColor === key ? '4px solid #fbbf24' : '2px solid rgba(255,255,255,0.2)',
                        cursor: taken ? 'not-allowed' : 'pointer',
                        opacity: taken ? 0.25 : 1,
                        transform: selectedColor === key ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.2s',
                        position: 'relative',
                      }}
                    >
                      {taken && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: '1.2rem' }}>✕</span>}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button className="glass-btn" onClick={() => setLobbyMode('choose')} style={{ flex: 1, padding: '10px' }}>← Geri</button>
                <button
                  className="glass-btn"
                  onClick={() => {
                    if (formRoomName.trim() && formPassword.trim() && selectedColor) {
                      joinRoom(formRoomName.trim(), formPassword.trim(), selectedColor);
                    }
                  }}
                  disabled={!myUsername.trim() || !formRoomName.trim() || !formPassword.trim() || !selectedColor}
                  style={{ flex: 2, padding: '10px', background: 'rgba(59, 130, 246, 0.3)', fontSize: '1rem' }}
                >
                  Katıl →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // LOBBY PHASE — Waiting Room
  // ═══════════════════════════════════════════════════
  if (phase === 'LOBBY') {
    const members = lobbyState?.members || [];
    const canStart = isOwner && members.length >= 3;

    return (
      <div style={{ padding: '24px', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ width: '450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <h1 style={{ textAlign: 'center', margin: 0, fontSize: '2rem', fontWeight: 800, letterSpacing: '2px' }}>CATAN</h1>

          <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Oda: </span>
            <strong style={{ fontSize: '1.2rem', color: '#fbbf24' }}>{roomName}</strong>
          </div>

          {lobbyError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.25)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '0.9rem', textAlign: 'center' }}>
              ⚠️ {lobbyError}
            </div>
          )}

          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Oyuncular ({members.length}/4):</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {members.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px',
                  border: m.isOwner ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.1)',
                  opacity: m.connected === false ? 0.4 : 1,
                }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: COLOR_MAP[m.color]?.hex || '#888', boxShadow: '0 0 8px rgba(0,0,0,0.5)' }} />
                <span style={{ flex: 1, fontSize: '1rem', fontWeight: 600 }}>{m.username}</span>
                {m.isOwner && <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#fbbf24', color: '#000', borderRadius: '4px', fontWeight: 700 }}>ODA SAHİBİ</span>}
                {m.connected === false && <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#ef4444', color: '#fff', borderRadius: '4px' }}>Bağlantı Koptu</span>}
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: 4 - members.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 16px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px',
                  border: '1px dashed rgba(255,255,255,0.1)'
                }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)' }} />
                <span style={{ flex: 1, fontSize: '0.9rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Bekleniyor...</span>
              </div>
            ))}
          </div>

          {/* Start Game / Wait */}
          {isOwner ? (
            <button
              className="glass-btn"
              onClick={startGame}
              disabled={!canStart}
              style={{
                padding: '14px', fontSize: '1.1rem',
                background: canStart ? 'rgba(34, 197, 94, 0.35)' : 'rgba(255,255,255,0.05)',
                border: canStart ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                color: canStart ? '#4ade80' : 'rgba(255,255,255,0.3)',
              }}
            >
              {canStart ? '🚀 Oyunu Başlat' : `⏳ En az 3 oyuncu gerekli (${members.length}/3)`}
            </button>
          ) : (
            <div style={{ textAlign: 'center', padding: '14px', color: '#fbbf24', fontSize: '1rem' }}>
              ⏳ Oda sahibinin oyunu başlatması bekleniyor...
            </div>
          )}
          
          <button className="glass-btn" onClick={leaveRoom} style={{ marginTop: '8px', padding: '10px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)' }}>🚪 Odadan Ayrıl</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // GAME PHASE — Main Game View
  // ═══════════════════════════════════════════════════
  if (gameState.turnOrder.length === 0 || !myPlayerId) {
    return (
      <div style={{ padding: '24px', width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
          <p>Oyun durumu yükleniyor...</p>
        </div>
      </div>
    );
  }

  const currentPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
  const currentPlayer = gameState.players[currentPlayerId];
  const isMyTurn = currentPlayerId === myPlayerId;

  return (
    <div style={{ padding: '24px', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* Header Bar */}
      <header className="glass-panel" style={{ width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, letterSpacing: '2px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>CATAN</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Oda: <strong style={{ color: '#fbbf24' }}>{roomName}</strong></p>
          {(gameState.turnPhase === 'SETUP_ROUND_1' || gameState.turnPhase === 'SETUP_ROUND_2') && (
            <div style={{ marginTop: '8px', padding: '4px 8px', background: '#fbbf24', color: '#000', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              Kurulum Aşaması: {gameState.turnPhase === 'SETUP_ROUND_1' ? '1. Tur' : '2. Tur (Ters Sıra)'} - 1 Köy, 1 Yol bedava!
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sıra Kimde:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: currentPlayer.color, boxShadow: '0 0 8px rgba(0,0,0,0.5)' }}></div>
              <strong style={{ fontSize: '1.2rem', color: currentPlayer.color }}>{currentPlayer.name}</strong>
            </div>
          </div>

          {gameState.diceState.rolled && diceResult && (
            <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              Zar: <strong style={{ fontSize: '1.5rem', color: '#fbbf24' }}>{diceResult}</strong>
            </div>
          )}

          <div className="header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {gameState.turnPhase === 'ROLL' && isMyTurn && (
              <button className="glass-btn action-btn" onClick={actions.rollDice} style={{ background: 'rgba(59, 130, 246, 0.2)' }}>🎲 Zar At</button>
            )}

            {(gameState.turnPhase === 'ROLL' || gameState.turnPhase === 'TRADE_BUILD') && isMyTurn && currentPlayer.devCards.knight > 0 && (
              <button className="glass-btn action-btn" onClick={() => actions.playKnight(myPlayerId)} style={{ border: '1px solid #ef4444', color: '#ef4444' }}>
                Şövalye Oyna
              </button>
            )}

            {(gameState.turnPhase === 'TRADE_BUILD' || gameState.turnPhase.startsWith('SETUP_')) && isMyTurn && (
              <button className="glass-btn action-btn" onClick={actions.endTurn} style={{ background: 'rgba(239, 68, 68, 0.2)' }}>Turu Bitir</button>
            )}

            {!isMyTurn && (
              <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', color: '#fbbf24' }}>
                ⏳ Sıranı Bekle...
              </div>
            )}
            
            <button className="glass-btn" onClick={leaveRoom} style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.2)', marginLeft: '12px' }}>🚪 Ayrıl</button>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="glass-panel game-main" style={{ flex: 1, width: '100%', maxWidth: '1400px', display: 'flex', overflow: 'hidden' }}>

        {/* Left Panel: Players */}
        <aside className={`game-sidebar ${isSidebarOpen ? 'open' : 'closed'}`} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', borderRight: '1px solid rgba(255,255,255,0.1)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Oyuncular</span>
            <button className="sidebar-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ padding: '4px 8px', fontSize: '0.7rem' }}>
              {isSidebarOpen ? '▲ Gizle' : '▼ Göster'}
            </button>
          </div>
          {isSidebarOpen && gameState.turnOrder.map(pid => (
            <PlayerPanel key={pid} player={gameState.players[pid]} isActive={currentPlayer.id === pid} />
          ))}

          <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {(gameState.turnPhase === 'TRADE_BUILD' || gameState.turnPhase.startsWith('SETUP_')) && isMyTurn && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>İnşaat Menüsü:</p>
                <button className="glass-btn" style={{ background: buildingMode === 'road' ? currentPlayer.color : undefined }} onClick={() => setBuildingMode(m => m === 'road' ? null : 'road')}>
                  Yol İnşa Et {gameState.turnPhase.startsWith('SETUP_') ? '(Bedava)' : '(1🌲 1🧱)'}
                </button>
                <button className="glass-btn" style={{ background: buildingMode === 'settlement' ? currentPlayer.color : undefined }} onClick={() => setBuildingMode(m => m === 'settlement' ? null : 'settlement')}>
                  Köy Kur {gameState.turnPhase.startsWith('SETUP_') ? '(Bedava)' : '(1🌲 1🧱 1🌾 1🐑)'}
                </button>
                {gameState.turnPhase === 'TRADE_BUILD' && (
                  <button className="glass-btn" style={{ background: buildingMode === 'city' ? currentPlayer.color : undefined }} onClick={() => setBuildingMode(m => m === 'city' ? null : 'city')}>
                    Şehre Yükselt (2🌾 3⛰️)
                  </button>
                )}
                {gameState.turnPhase === 'TRADE_BUILD' && (
                  <button className="glass-btn" onClick={() => actions.buyDevCard(currentPlayer.id)} style={{ border: '1px solid #a855f7', color: '#d8b4fe' }}>
                    Gelişim Kartı Al (1🌾 1🐑 1⛰️)
                  </button>
                )}
                {gameState.turnPhase === 'TRADE_BUILD' && (
                  <button className="glass-btn" onClick={() => setTradeMode(!tradeMode)} style={{ border: '1px solid #06b6d4', color: '#67e8f9' }}>
                    Banka Takası (4:1)
                  </button>
                )}

                {/* Bank Trade UI */}
                {tradeMode && (
                  <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#cbd5e1' }}>4 adet vereceğin kaynağı seç:</p>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {(['wood', 'brick', 'wheat', 'sheep', 'ore'] as ResourceType[]).map(res => (
                        <button
                          key={`offer-${res}`}
                          onClick={() => setTradeOffer(res)}
                          style={{
                            padding: '4px 8px',
                            background: tradeOffer === res ? '#06b6d4' : 'rgba(255,255,255,0.1)',
                            border: 'none', borderRadius: '4px',
                            color: tradeOffer === res ? '#000' : '#fff',
                            cursor: currentPlayer.resources[res] >= 4 ? 'pointer' : 'not-allowed',
                            opacity: currentPlayer.resources[res] >= 4 ? 1 : 0.3
                          }}
                          disabled={currentPlayer.resources[res] < 4}
                        >
                          {res === 'wood' ? '🌲' : res === 'brick' ? '🧱' : res === 'wheat' ? '🌾' : res === 'sheep' ? '🐑' : '⛰️'}
                        </button>
                      ))}
                    </div>
                    {tradeOffer && (
                      <>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#cbd5e1' }}>1 adet alacağın kaynağı seç:</p>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(['wood', 'brick', 'wheat', 'sheep', 'ore'] as ResourceType[]).map(res => (
                            <button
                              key={`ask-${res}`}
                              onClick={() => {
                                actions.tradeWithBank(currentPlayer.id, tradeOffer, res);
                                setTradeMode(false);
                                setTradeOffer(null);
                              }}
                              style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                            >
                              {res === 'wood' ? '🌲' : res === 'brick' ? '🧱' : res === 'wheat' ? '🌾' : res === 'sheep' ? '🐑' : '⛰️'}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Right Panel: Board */}
        <div className="game-board-area" style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Disconnection Warning Banner */}
          {disconnectedPlayer && (
            <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(239, 68, 68, 0.85)', padding: '10px 20px', borderRadius: '12px', color: '#fff', fontWeight: 'bold', zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', fontSize: '0.9rem', textAlign: 'center' }}>
              ⚠️ {disconnectedPlayer.username} bağlantısı koptu! {Math.round(disconnectedPlayer.timeoutMs / 1000)}s içinde gelmezse sırası atlanacak.
            </div>
          )}
          {gameState.turnPhase === 'ROBBER_MOVE' && (
            <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(239, 68, 68, 0.9)', padding: '12px 24px', borderRadius: '20px', color: '#fff', fontWeight: 'bold', zIndex: 10, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
              ⚠️ Hırsızı hareket ettirmek için bir altıgen seçin!
            </div>
          )}
          {buildingMode && gameState.turnPhase !== 'ROBBER_MOVE' && (
            <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', padding: '8px 16px', borderRadius: '20px', color: '#fbbf24', zIndex: 10 }}>
              {buildingMode === 'road' && 'Haritadan bir kenar (yol) seçin'}
              {buildingMode === 'settlement' && 'Haritadan bir köşe (köy) seçin'}
              {buildingMode === 'city' && 'Haritadan mevcut bir köyünüzü seçin'}
            </div>
          )}

          <div
            ref={containerRef}
            style={{
              width: '100%', height: '100%', perspective: '1200px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', cursor: 'grab', touchAction: 'none'
            }}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
            onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
          >
            <animated.div style={{
              width: '800px', height: '800px',
              x, y, scale, rotateX, rotateZ,
              transformStyle: 'preserve-3d',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <HexGrid
                size={70}
                board={gameState.board}
                buildings={gameState.buildings}
                roads={gameState.roads}
                players={gameState.players}
                robberHexId={gameState.robberHexId}
                onHexClick={(hexId) => {
                  if (!isMyTurn) return;
                  if (gameState.turnPhase === 'ROBBER_MOVE') {
                    if (hexId === gameState.robberHexId) return;
                    const adjacentNodes = gameState.board!.graph.nodes.filter(n => n.adjacentHexes.includes(hexId));
                    const adjacentPlayerIds = Array.from(new Set(adjacentNodes.map(n => gameState.buildings[n.id]?.playerId).filter(p => p && p !== currentPlayer.id)));
                    const stealFromId = adjacentPlayerIds.length > 0 ? (adjacentPlayerIds[Math.floor(Math.random() * adjacentPlayerIds.length)] as string) : null;
                    actions.moveRobber(hexId, stealFromId, currentPlayer.id);
                  }
                }}
                onNodeClick={(nodeId) => {
                  if (!isMyTurn) return;
                  if (buildingMode === 'settlement') {
                    actions.buildSettlement(nodeId, myPlayerId);
                  } else if (buildingMode === 'city') {
                    actions.upgradeCity(nodeId, myPlayerId);
                  }
                }}
                onEdgeClick={(edgeId) => {
                  if (!isMyTurn) return;
                  if (buildingMode === 'road') {
                    actions.buildRoad(edgeId, myPlayerId);
                  }
                }}
              />
            </animated.div>
          </div>
        </div>
      </main>

      {/* Mobile Floating Action Bar */}
      <div className="mobile-fab">
        {gameState.turnPhase === 'ROLL' && isMyTurn && (
          <button className="glass-btn" onClick={actions.rollDice} style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
            <span style={{ fontSize: '1.2rem' }}>🎲</span>
            Zar At
          </button>
        )}
        {(gameState.turnPhase === 'TRADE_BUILD' || gameState.turnPhase.startsWith('SETUP_')) && isMyTurn && (
          <>
            <button className="glass-btn" onClick={() => { setIsSidebarOpen(true); setTimeout(() => window.scrollTo(0, 0), 100); }} style={{ background: 'rgba(34, 197, 94, 0.2)' }}>
              <span style={{ fontSize: '1.2rem' }}>🔨</span>
              İnşa Et
            </button>
            <button className="glass-btn" onClick={actions.endTurn} style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
              <span style={{ fontSize: '1.2rem' }}>⏭️</span>
              Turu Bitir
            </button>
          </>
        )}
        {!isMyTurn && (
          <div style={{ padding: '8px', textAlign: 'center', color: '#fbbf24', fontSize: '0.9rem', width: '100%' }}>
            ⏳ Başkasının Sırası...
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
