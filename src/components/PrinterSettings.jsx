import { useState, useEffect } from 'react';
import { printService } from '../lib/printer';

const TRANSPORT_INFO = {
  bridge: {
    label: 'WiFi / LAN Bridge',
    icon: '🌐',
    desc: 'Works on iOS, Android, any browser. Requires the print bridge server running on your local network.',
    ios: true,
  },
  bluetooth: {
    label: 'Bluetooth (Web)',
    icon: '🔵',
    desc: 'Direct Bluetooth connection. Chrome and Android only — not supported on iOS Safari.',
    ios: false,
  },
  sunmi: {
    label: 'Sunmi Native',
    icon: '📱',
    desc: 'Uses the built-in Sunmi AIDL bridge. Only works on Sunmi Android devices (D3 Pro, T2, etc.)',
    ios: false,
  },
  browser: {
    label: 'Browser Print',
    icon: '🖨',
    desc: 'Falls back to window.print() — no ESC/POS, no cut, no cash drawer. Use as last resort.',
    ios: true,
  },
};

export default function PrinterSettings() {
  const [config, setConfig]     = useState(printService.getConfig());
  const [status, setStatus]     = useState(null);  // null | 'testing' | 'ok' | 'error'
  const [statusMsg, setStatusMsg] = useState('');
  const [testMsg, setTestMsg]   = useState('');

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const save = (patch) => {
    const next = { ...config, ...patch };
    setConfig(next);
    printService.saveConfig(next);
  };

  const testConnection = async () => {
    setStatus('testing');
    setStatusMsg('');
    try {
      const data = await printService.testBridge(config.bridgeUrl);
      setStatus('ok');
      setStatusMsg(`Connected · Bridge v${data.version || '?'} · Printer: ${data.printers?.join(', ') || 'none'}`);
    } catch (err) {
      setStatus('error');
      setStatusMsg(err.message || 'Cannot reach bridge server');
    }
  };

  const sendTestPrint = async () => {
    setTestMsg('Sending…');
    try {
      await printService.printTestPage();
      setTestMsg('Test page sent ✓');
    } catch (err) {
      setTestMsg(`Failed: ${err.message}`);
    }
    setTimeout(() => setTestMsg(''), 4000);
  };

  const statusColor = { ok:'var(--grn)', error:'var(--red)', testing:'var(--acc)' }[status] || 'var(--t3)';

  return (
    <div style={{ maxWidth:560 }}>
      <div style={{ fontSize:16, fontWeight:700, color:'var(--t1)', marginBottom:4 }}>Printer settings</div>
      <div style={{ fontSize:12, color:'var(--t3)', marginBottom:20 }}>
        Configure how this device connects to the Sunmi NT311 or any ESC/POS printer
      </div>

      {/* Transport selector */}
      <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Connection method</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:22 }}>
        {Object.entries(TRANSPORT_INFO).map(([key, info]) => {
          const active = config.transport === key;
          const unavailable = key === 'bluetooth' && !navigator.bluetooth;
          const sunmiUnavailable = key === 'sunmi' && !window.SunmiPrint && !window.sunmi;
          const disabled = unavailable || sunmiUnavailable;
          return (
            <div key={key} onClick={() => !disabled && save({ transport: key })} style={{
              padding:'12px 14px', borderRadius:12, cursor:disabled?'not-allowed':'pointer',
              background: active ? 'var(--acc-d)' : 'var(--bg3)',
              border:`1.5px solid ${active?'var(--acc)':'var(--bdr)'}`,
              opacity: disabled ? .4 : 1,
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:20 }}>{info.icon}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:active?'var(--acc)':'var(--t1)' }}>{info.label}</div>
                    <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{info.desc}</div>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0, marginLeft:12 }}>
                  {info.ios && <span style={{ fontSize:10, padding:'2px 6px', borderRadius:8, background:'var(--bg4)', color:'var(--t3)' }}>iOS ✓</span>}
                  {disabled && <span style={{ fontSize:10, padding:'2px 6px', borderRadius:8, background:'var(--red-d)', color:'var(--red)', border:'1px solid var(--red-b)' }}>Not available</span>}
                  {active && <span style={{ fontSize:10, padding:'2px 6px', borderRadius:8, background:'var(--acc)', color:'#0e0f14', fontWeight:700 }}>Active</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bridge config — shown when bridge transport active */}
      {config.transport === 'bridge' && (
        <div style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:14, padding:'14px 16px', marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--t2)', marginBottom:10 }}>Bridge server URL</div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <input
              value={config.bridgeUrl}
              onChange={e => save({ bridgeUrl: e.target.value })}
              className="input"
              placeholder="http://192.168.1.x:3001"
              style={{ flex:1, fontFamily:'DM Mono,monospace', fontSize:13 }}
            />
            <button onClick={testConnection} className="btn btn-ghost btn-sm" style={{ flexShrink:0, width:80 }}>
              {status==='testing' ? '…' : 'Test'}
            </button>
          </div>
          {status && (
            <div style={{ fontSize:11, color:statusColor, display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:statusColor }}/>
              {statusMsg || (status==='testing'?'Connecting…':'')}
            </div>
          )}
          <div style={{ marginTop:12, fontSize:11, color:'var(--t3)', lineHeight:1.7 }}>
            Run the print bridge server on any device on your network:
            <code style={{ display:'block', background:'var(--bg1)', borderRadius:6, padding:'6px 10px', marginTop:6, fontFamily:'DM Mono,monospace', fontSize:11 }}>
              node print-bridge.js --ip 192.168.1.100
            </code>
            Replace <code>192.168.1.100</code> with your NT311's IP address (found by printing a self-test page).
          </div>
        </div>
      )}

      {/* Paper / print options */}
      <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Print options</div>
      <div style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:14, padding:'14px 16px', marginBottom:16 }}>
        {[
          { key:'autoCut', label:'Auto cut', desc:'Cut paper after each print job' },
          { key:'cashDrawer', label:'Open cash drawer', desc:'Trigger cash drawer on cash payment' },
        ].map(opt => (
          <div key={opt.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:10, marginBottom:10, borderBottom:'1px solid var(--bdr)' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--t1)' }}>{opt.label}</div>
              <div style={{ fontSize:11, color:'var(--t3)' }}>{opt.desc}</div>
            </div>
            <div onClick={() => save({ [opt.key]: !config[opt.key] })} style={{
              width:42, height:24, borderRadius:12, cursor:'pointer', position:'relative',
              background: config[opt.key] ? 'var(--acc)' : 'var(--bg4)',
              border:`1px solid ${config[opt.key]?'var(--acc)':'var(--bdr2)'}`,
              transition:'all .2s',
            }}>
              <div style={{
                width:18, height:18, borderRadius:'50%', background:'#fff',
                position:'absolute', top:2, transition:'left .2s',
                left: config[opt.key] ? 20 : 2,
                boxShadow:'0 1px 3px rgba(0,0,0,.3)',
              }}/>
            </div>
          </div>
        ))}

        {/* Paper width */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--t1)' }}>Paper width</div>
            <div style={{ fontSize:11, color:'var(--t3)' }}>NT311 uses 80mm (42 chars)</div>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            {[[42,'80mm'],[30,'58mm']].map(([w,l]) => (
              <button key={w} onClick={() => save({ charWidth: w })} style={{
                padding:'4px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                background: config.charWidth===w?'var(--acc-d)':'var(--bg4)',
                border:`1px solid ${config.charWidth===w?'var(--acc-b)':'var(--bdr2)'}`,
                color: config.charWidth===w?'var(--acc)':'var(--t3)',
                fontSize:12, fontWeight:600,
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Test buttons */}
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={sendTestPrint} className="btn btn-acc" style={{ flex:1, height:42 }}>
          🖨 Print test page
        </button>
        <button onClick={() => printService.openCashDrawer().catch(()=>{})} className="btn btn-ghost" style={{ flex:1, height:42 }}>
          🗄 Open cash drawer
        </button>
      </div>
      {testMsg && (
        <div style={{ marginTop:8, fontSize:12, color: testMsg.includes('✓') ? 'var(--grn)' : 'var(--red)', textAlign:'center' }}>
          {testMsg}
        </div>
      )}

      {/* Setup guide */}
      <div style={{ marginTop:20, background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:14, padding:'14px 16px' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--t2)', marginBottom:10 }}>🗺 Setup guide — NT311</div>
        <div style={{ fontSize:11, color:'var(--t3)', lineHeight:1.9 }}>
          <strong style={{ color:'var(--t2)' }}>1. Connect to WiFi</strong> — hold the feed button during power-on to print a config sheet. Set the WiFi SSID and password using the Sunmi utility app.<br/>
          <strong style={{ color:'var(--t2)' }}>2. Find the printer IP</strong> — press the feed button to print a self-test page with the IP address.<br/>
          <strong style={{ color:'var(--t2)' }}>3. Run the bridge</strong> — on any device on the same network:
          <code style={{ display:'block', background:'var(--bg1)', borderRadius:6, padding:'6px 10px', margin:'6px 0', fontFamily:'DM Mono,monospace' }}>
            node print-bridge.js --ip 192.168.x.x
          </code>
          <strong style={{ color:'var(--t2)' }}>4. Enter the bridge URL</strong> — e.g. <code>http://192.168.1.50:3001</code> in the field above.<br/>
          <strong style={{ color:'var(--t2)' }}>5. Test</strong> — hit "Test" to confirm connection, then "Print test page" to verify printing.
        </div>
      </div>
    </div>
  );
}
