import React from 'react';
import type { Player } from '../game/gameState';

interface PlayerPanelProps {
  player: Player;
  isActive: boolean;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({ player, isActive }) => {
  return (
    <div className={`glass-panel player-panel ${isActive ? 'active-player' : ''}`} style={{ 
      padding: '16px', 
      minWidth: '220px',
      border: isActive ? `2px solid ${player.color}` : '1px solid rgba(255,255,255,0.1)',
      transition: 'all 0.3s ease',
      boxShadow: isActive ? `0 0 15px ${player.color}40` : 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: player.color, border: '1px solid rgba(255,255,255,0.3)' }}></div>
        <strong style={{ fontSize: '1.1rem', color: isActive ? player.color : '#e2e8f0' }}>{player.name}</strong>
        <span style={{ marginLeft: 'auto', fontSize: '0.9rem', color: '#fbbf24', fontWeight: 'bold' }}>⭐ {player.victoryPoints}</span>
      </div>
      
      {/* Resources */}
      <div className="resources" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', fontSize: '0.9rem' }}>
        <div className="res-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '6px 4px', borderRadius: '4px' }}>
          <span style={{ fontSize: '1.2rem', marginBottom: '4px' }}>🌲</span>
          <strong style={{ color: player.resources.wood > 0 ? '#fff' : '#64748b' }}>{player.resources.wood}</strong>
        </div>
        <div className="res-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '6px 4px', borderRadius: '4px' }}>
          <span style={{ fontSize: '1.2rem', marginBottom: '4px' }}>🧱</span>
          <strong style={{ color: player.resources.brick > 0 ? '#fff' : '#64748b' }}>{player.resources.brick}</strong>
        </div>
        <div className="res-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '6px 4px', borderRadius: '4px' }}>
          <span style={{ fontSize: '1.2rem', marginBottom: '4px' }}>🌾</span>
          <strong style={{ color: player.resources.wheat > 0 ? '#fff' : '#64748b' }}>{player.resources.wheat}</strong>
        </div>
        <div className="res-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '6px 4px', borderRadius: '4px' }}>
          <span style={{ fontSize: '1.2rem', marginBottom: '4px' }}>🐑</span>
          <strong style={{ color: player.resources.sheep > 0 ? '#fff' : '#64748b' }}>{player.resources.sheep}</strong>
        </div>
      </div>
      
      {/* Achievements & Dev Cards */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
           <span title="Gelişim Kartları">🃏 {Object.values(player.devCards).reduce((a,b)=>a+b, 0)}</span>
           <span title="Oynanan Şövalyeler" style={{ color: player.largestArmyAPI ? '#ef4444' : undefined }}>⚔️ {player.playedKnights} {player.largestArmyAPI && '(En Büyük Ordu)'}</span>
        </div>
        {player.longestRoadAPI && <span title="En Uzun Yol" style={{ color: '#eab308' }}>🛣️ En Uzun Yol</span>}
      </div>

    </div>
  );
};
