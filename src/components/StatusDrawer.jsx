import { useState, useEffect } from 'react';
import { useStore } from '../store';

export default function StatusDrawer({ onClose }) {
  const {
    deviceConfig, clearDeviceConfig, syncStatus, setSyncStatus,
    devices, setAppMode, markTerminalSynced,
  } = useStore();

  const [tick, setTick] = useState(0);

  // Re-render every 30s to update "last seen" times
  useEffect(() => {
    const id = setInterval(() => setTick(t => t+1), 30000);
    return () => clearInterval(id);
  }, []);

  // Poll print bridge to get real printer status
  useEffect(() => {
    const printers = (() => { try { return JSON.parse(localStorage.getItem('rpos-printers') || '[]'); } catch { return []; } })();
    if (!printers.length) return;
    const poll = async () => {
      const cfg = (() => { try { return JSON.parse(localStorage.getItem('rpos-printer-config') || '{}'); } catch { return {}; } })();
      const bridgeUrl = cfg.bridgeUrl || 'http://localhost:3001';
      try {
        const res = await fetch(`${bridgeUrl}/status`, { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        setSyncStatus({ printerOnline: !!data.ok });
      } catch {
        setSyncStatus({ printerOnline: false });
      }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  const timeSince = (ts) => {
    if (!ts) return 'never';
    const t = ts instanceof Date ? ts.getTime() : typeof ts === 'string' ? new Date(ts).getTime() : Number(ts);
    const mins = Math.floor((Date.now() - t) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins/60)}h ${mins%60}m ago`;
  };

  const hwStatus = [
    {
      label: 'Receipt printer',
      icon: '🖨',
      status: syncStatus.printerOnline ? 'online' : 'offline',
      sub: syncStatus.printerOnline ? 'Sunmi NT311 connected' : 'Not reachable',
      toggle: () => setSyncStatus({ printerOnline: !syncStatus.printerOnline }),
    },
    {
      label: 'Payment terminal',
      icon: '💳',
      status: syncStatus.paymentTerminalOnline ? 'online' : 'offline',
      sub: syncStatus.paymentTerminalOnline ? 'Stripe Terminal connected' : 'Not reachable',
      toggle: () => setSyncStatus({ paymentTerminalOnline: !syncStatus.paymentTerminalOnline }),
    },
    {
      label: 'Kitchen display',
      icon: '📋',
      status: syncStatus.kdsOnline ? 'online' : 'offline',
      sub: syncStatus.kdsOnline ? 'KDS receiving tickets' : 'KDS offline',
      toggle: () => setSyncStatus({ kdsOnline: !syncStatus.kdsOnline }),
    },
  ];

  const allOnline = hwStatus.every(h => h.status === 'online');
  const syncOk = !syncStatus.pendingChanges;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:200, backdropFilter:'blur(2px)' }}
      />

      {/* Drawer */}
      <div style={{
        position:'fixed', left:58, top:0, bottom:0, width:320,
        background:'var(--bg1)', borderRight:'1px solid var(--bdr)',
        zIndex:201, display:'flex', flexDirection:'column',
        boxShadow:'4px 0 24px rgba(0,0,0,.25)',
        animation:'slideRight .2s cubic-bezier(.2,.8,.3,1)',
      }}>
        {/* Header */}
        <div style={{ padding:'16px 18px 14px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--t1)' }}>Terminal status</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
              {allOnline && syncOk ? '✓ All systems operational' : '⚠ Issues detected'}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:22, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>

          {/* Config sync status */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Config sync</div>
            <div style={{
              padding:'12px 14px', borderRadius:12,
              background: syncOk ? 'var(--grn-d)' : 'var(--acc-d)',
              border:`1px solid ${syncOk ? 'var(--grn-b)' : 'var(--acc-b)'}`,
              marginBottom:8,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: syncOk ? 'var(--grn)' : 'var(--acc)', animation: syncOk ? 'none' : 'pulse 1.5s ease-in-out infinite' }}/>
                <span style={{ fontSize:13, fontWeight:700, color: syncOk ? 'var(--grn)' : 'var(--acc)' }}>
                  {syncOk ? 'Synced via BroadcastChannel' : 'Changes pending'}
                </span>
              </div>
              <div style={{ fontSize:11, color:'var(--t3)' }}>
                Last sync: {timeSince(syncStatus.lastTerminalSync)}
                {syncStatus.lastConfigChange && <span style={{ marginLeft:8, color:'var(--t4)' }}>· Config changed: {timeSince(syncStatus.lastConfigChange)}</span>}
              </div>
              <div style={{ fontSize:11, color:'var(--t4)', marginTop:4 }}>
                Cross-tab sync is live — tables, orders, KDS tickets, 86 list and menu changes sync instantly across all open terminals
              </div>
            </div>
            {syncStatus.pendingChanges && (
              <button onClick={() => { markTerminalSynced(); }} style={{
                width:'100%', padding:'8px', borderRadius:9, cursor:'pointer', fontFamily:'inherit',
                background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700,
              }}>Sync now</button>
            )}
          </div>

          {/* Active profile */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Device profile</div>
            {deviceConfig ? (
              <div style={{ padding:'12px 14px', background:'var(--bg3)', borderRadius:12, border:'1px solid var(--bdr)' }}>
                <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', marginBottom:8 }}>{deviceConfig.profileName || 'Custom config'}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <Row label="Default screen" value={deviceConfig.defaultSurface}/>
                  <Row label="Order types" value={(deviceConfig.enabledOrderTypes||[]).join(', ')}/>
                  <Row label="Section" value={deviceConfig.assignedSection || 'All'}/>
                  <Row label="Table service" value={deviceConfig.tableServiceEnabled ? '✓ On' : '✕ Off'}/>
                </div>
                <div style={{ marginTop:10, display:'flex', gap:6 }}>
                  <button onClick={() => setAppMode('backoffice')} style={{
                    flex:1, padding:'6px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                    background:'var(--bg4)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:11, fontWeight:600,
                  }}>Change in Back Office</button>
                  <button onClick={() => { clearDeviceConfig(); onClose(); }} style={{
                    padding:'6px 10px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                    background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:11, fontWeight:700,
                  }}>Reset</button>
                </div>
              </div>
            ) : (
              <div style={{ padding:'16px 14px', background:'var(--red-d)', borderRadius:12, border:'1px solid var(--red-b)', textAlign:'center' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--red)', marginBottom:4 }}>No profile assigned</div>
                <div style={{ fontSize:11, color:'var(--red)', opacity:.8, marginBottom:12 }}>Go to Back Office → Device Profiles to assign a profile to this terminal</div>
                <button onClick={() => { setAppMode('backoffice'); onClose(); }} style={{
                  padding:'7px 16px', borderRadius:9, cursor:'pointer', fontFamily:'inherit',
                  background:'var(--red)', border:'none', color:'#fff', fontSize:12, fontWeight:700,
                }}>Open Back Office →</button>
              </div>
            )}
          </div>

          {/* Hardware status */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Hardware</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {hwStatus.map(hw => (
                <div key={hw.label} style={{
                  padding:'11px 14px', borderRadius:12, border:'1px solid var(--bdr)',
                  background:'var(--bg3)', display:'flex', alignItems:'center', gap:12,
                }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{hw.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--t1)' }}>{hw.label}</div>
                    <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{hw.sub}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background: hw.status==='online'?'var(--grn)':'var(--red)', boxShadow: hw.status==='online'?'0 0 6px var(--grn)':undefined }}/>
                    <button onClick={hw.toggle} style={{
                      fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, cursor:'pointer', fontFamily:'inherit',
                      background: hw.status==='online'?'var(--grn-d)':'var(--red-d)',
                      border:`1px solid ${hw.status==='online'?'var(--grn-b)':'var(--red-b)'}`,
                      color: hw.status==='online'?'var(--grn)':'var(--red)',
                    }}>{hw.status}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal ID */}
          <div style={{ padding:'10px 14px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--bdr)' }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Terminal identity</div>
            <Row label="Device ID"    value={deviceConfig?.deviceId || 'Unpaired'}/>
            <Row label="App version"  value="v0.7.1"/>
            <Row label="Mode"         value="POS terminal"/>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 18px', borderTop:'1px solid var(--bdr)' }}>
          <button onClick={() => { setAppMode('backoffice'); onClose(); }} style={{
            width:'100%', padding:'10px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
            background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t2)', fontSize:13, fontWeight:600,
            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          }}>
            <span>⚙</span> Open Back Office
          </button>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
      <span style={{ color:'var(--t4)' }}>{label}</span>
      <span style={{ color:'var(--t2)', fontWeight:500 }}>{value}</span>
    </div>
  );
}
