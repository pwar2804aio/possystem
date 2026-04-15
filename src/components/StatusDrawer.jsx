import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import { VERSION } from '../lib/version';

export default function StatusDrawer({ onClose }) {
  const { deviceConfig, clearDeviceConfig, syncStatus, setAppMode } = useStore();
  const [printers, setPrinters] = useState([]);
  const [printerStatuses, setPrinterStatuses] = useState({}); // id → 'checking'|'online'|'offline'|'unknown'
  const [printJobs, setPrintJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  // Load printers from localStorage (pushed via config snapshot)
  useEffect(() => {
    const load = () => {
      try { setPrinters(JSON.parse(localStorage.getItem('rpos-printers') || '[]')); } catch {}
    };
    load();
    window.addEventListener('rpos-printers-updated', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('rpos-printers-updated', load);
      window.removeEventListener('storage', load);
    };
  }, []);

  // Check each printer's actual status by looking at recent print_jobs
  const checkPrinterStatuses = useCallback(async () => {
    if (!supabase || !printers.length) return;
    const statuses = {};
    // Check the most recent job per printer — if it succeeded recently = online, if failed = offline
    for (const printer of printers) {
      statuses[printer.id] = 'checking';
    }
    setPrinterStatuses({ ...statuses });

    try {
      const { data } = await supabase
        .from('print_jobs')
        .select('printer_id, status, created_at')
        .in('printer_id', printers.map(p => p.id))
        .order('created_at', { ascending: false })
        .limit(50);

      for (const printer of printers) {
        const jobs = (data || []).filter(j => j.printer_id === printer.id);
        if (!jobs.length) {
          statuses[printer.id] = 'unknown';
        } else {
          const latest = jobs[0];
          const ageMs = Date.now() - new Date(latest.created_at).getTime();
          // If latest job is recent and done → online; if failed → offline; if pending for >30s → stale
          if (latest.status === 'done') {
            statuses[printer.id] = ageMs < 5 * 60000 ? 'online' : 'unknown';
          } else if (latest.status === 'failed') {
            statuses[printer.id] = 'offline';
          } else if (latest.status === 'pending' && ageMs > 30000) {
            statuses[printer.id] = 'offline'; // agent not picking up
          } else {
            statuses[printer.id] = 'checking';
          }
        }
      }
    } catch {
      printers.forEach(p => { statuses[p.id] = 'unknown'; });
    }
    setPrinterStatuses({ ...statuses });
  }, [printers]);

  useEffect(() => {
    checkPrinterStatuses();
    const id = setInterval(checkPrinterStatuses, 15000);
    return () => clearInterval(id);
  }, [checkPrinterStatuses]);

  // Load recent print jobs
  const loadJobs = useCallback(async () => {
    if (!supabase) { setJobsLoading(false); return; }
    setJobsLoading(true);
    try {
      const { getLocationId } = await import('../lib/supabase.js');
      const locId = await getLocationId();
      if (!locId) { setJobsLoading(false); return; }
      const { data } = await supabase
        .from('print_jobs')
        .select('id, printer_id, printer_ip, job_type, status, error, created_at, printed_at')
        .eq('location_id', locId)
        .order('created_at', { ascending: false })
        .limit(20);
      setPrintJobs(data || []);
    } catch {}
    setJobsLoading(false);
  }, []);

  useEffect(() => {
    loadJobs();
    // Subscribe to realtime updates on print_jobs
    if (!supabase) return;
    const ch = supabase.channel('status-drawer-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs' }, () => loadJobs())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadJobs]);

  const retryJob = async (job) => {
    if (!supabase) return;
    await supabase.from('print_jobs').update({ status: 'pending', error: null }).eq('id', job.id);
    loadJobs();
  };

  const timeSince = (ts) => {
    if (!ts) return '—';
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins/60)}h ${mins%60}m ago`;
  };

  const statusColor = (s) => ({
    online: 'var(--grn)', offline: 'var(--red)', checking: 'var(--acc)', unknown: 'var(--t4)'
  }[s] || 'var(--t4)');

  const statusBg = (s) => ({
    online: 'var(--grn-d)', offline: 'var(--red-d)', checking: 'var(--acc-d)', unknown: 'var(--bg3)'
  }[s] || 'var(--bg3)');

  const statusBdr = (s) => ({
    online: 'var(--grn-b)', offline: 'var(--red-b)', checking: 'var(--acc-b)', unknown: 'var(--bdr)'
  }[s] || 'var(--bdr)');

  const jobStatusColor = (s) => ({
    done: 'var(--grn)', failed: 'var(--red)', pending: 'var(--acc)', printing: 'var(--acc)'
  }[s] || 'var(--t4)');

  const printerForId = (id) => printers.find(p => p.id === id);

  const allOk = printers.length === 0 || printers.every(p => printerStatuses[p.id] === 'online');
  const hasIssues = printers.some(p => printerStatuses[p.id] === 'offline') ||
    printJobs.some(j => j.status === 'failed' || (j.status === 'pending' && Date.now() - new Date(j.created_at).getTime() > 30000));

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:200, backdropFilter:'blur(2px)' }}/>
      <div style={{ position:'fixed', left:58, top:0, bottom:0, width:340, background:'var(--bg1)', borderRight:'1px solid var(--bdr)', zIndex:201, display:'flex', flexDirection:'column', boxShadow:'4px 0 24px rgba(0,0,0,.25)', animation:'slideRight .2s cubic-bezier(.2,.8,.3,1)', overflow:'hidden' }}>
        
        {/* Header */}
        <div style={{ padding:'16px 18px 14px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--t1)' }}>Terminal status</div>
            <div style={{ fontSize:11, color: hasIssues ? 'var(--red)' : allOk ? 'var(--grn)' : 'var(--t3)', marginTop:2 }}>
              {hasIssues ? '⚠ Hardware issues detected' : allOk && printers.length > 0 ? '✓ All hardware operational' : '— No hardware configured'}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:22 }}>×</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>

          {/* Device profile */}
          <Section label="Device profile">
            {deviceConfig ? (
              <div style={{ padding:'12px 14px', background:'var(--bg3)', borderRadius:12, border:'1px solid var(--bdr)' }}>
                <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', marginBottom:6 }}>{deviceConfig.profileName || 'Custom config'}</div>
                <Row label="Screen" value={deviceConfig.defaultSurface}/>
                <Row label="Order types" value={(deviceConfig.enabledOrderTypes||[]).join(', ')}/>
                <Row label="Table service" value={deviceConfig.tableServiceEnabled ? '✓ On' : '✕ Off'}/>
              </div>
            ) : (
              <Alert color="red" text="No profile assigned — go to Back Office → Device Profiles"/>
            )}
          </Section>

          {/* Printers — live from configured hardware only */}
          <Section label="Printers">
            {printers.length === 0 ? (
              <Alert color="t4" text="No printers configured. Add printers in Back Office → Printers, then Push to POS."/>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {printers.map(printer => {
                  const st = printerStatuses[printer.id] || 'unknown';
                  return (
                    <div key={printer.id} style={{ padding:'11px 14px', borderRadius:12, border:`1px solid ${statusBdr(st)}`, background:statusBg(st) }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:18, flexShrink:0 }}>🖨</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'var(--t1)', display:'flex', alignItems:'center', gap:6 }}>
                            {printer.name}
                            {printer.roles?.includes('receipt') && <Chip>Receipt</Chip>}
                            {printer.roles?.includes('kitchen') && <Chip color="blue">Kitchen</Chip>}
                          </div>
                          <div style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>{printer.model?.toUpperCase()} · {printer.address}</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                          <div style={{ width:8, height:8, borderRadius:'50%', background:statusColor(st), boxShadow:st==='online'?`0 0 6px ${statusColor(st)}`:undefined }}/>
                          <span style={{ fontSize:10, fontWeight:700, color:statusColor(st), textTransform:'uppercase' }}>
                            {st === 'checking' ? '…' : st}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Print queue */}
          <Section label={`Print queue${printJobs.filter(j=>j.status==='failed'||j.status==='pending').length > 0 ? ` ⚠` : ''}`}>
            {jobsLoading ? (
              <div style={{ fontSize:11, color:'var(--t4)', padding:'8px 0' }}>Loading…</div>
            ) : printJobs.length === 0 ? (
              <div style={{ fontSize:11, color:'var(--t4)', padding:'8px 0' }}>No recent print jobs</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {printJobs.slice(0, 10).map(job => {
                  const printer = printerForId(job.printer_id);
                  const isStale = job.status === 'pending' && Date.now() - new Date(job.created_at).getTime() > 30000;
                  const effectiveStatus = isStale ? 'failed' : job.status;
                  return (
                    <div key={job.id} style={{ padding:'9px 12px', borderRadius:10, background:'var(--bg3)', border:`1px solid ${effectiveStatus==='failed'?'var(--red-b)':effectiveStatus==='done'?'var(--grn-b)':'var(--bdr)'}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:7, height:7, borderRadius:'50%', background:jobStatusColor(effectiveStatus), flexShrink:0 }}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'var(--t1)' }}>
                            {job.job_type?.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())} — {printer?.name || job.printer_ip}
                          </div>
                          <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>
                            {timeSince(job.created_at)}
                            {job.error && <span style={{ color:'var(--red)', marginLeft:6 }}>· {job.error.slice(0,40)}</span>}
                            {isStale && !job.error && <span style={{ color:'var(--red)', marginLeft:6 }}>· Agent not responding</span>}
                          </div>
                        </div>
                        <span style={{ fontSize:10, fontWeight:700, color:jobStatusColor(effectiveStatus), textTransform:'uppercase', flexShrink:0 }}>{effectiveStatus}</span>
                        {(effectiveStatus === 'failed') && (
                          <button onClick={() => retryJob(job)} style={{ padding:'2px 8px', borderRadius:6, cursor:'pointer', fontFamily:'inherit', fontSize:10, fontWeight:700, background:'var(--acc)', border:'none', color:'#0b0c10', flexShrink:0 }}>Retry</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button onClick={loadJobs} style={{ fontSize:10, color:'var(--t4)', background:'none', border:'none', cursor:'pointer', padding:'4px 0', fontFamily:'inherit', textAlign:'left' }}>↻ Refresh</button>
              </div>
            )}
          </Section>

          {/* Terminal info */}
          <Section label="Terminal">
            <div style={{ padding:'10px 14px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--bdr)' }}>
              <Row label="Device" value={deviceConfig?.terminalName || 'POS'}/>
              <Row label="Version" value={`v${VERSION}`}/>
              <Row label="Config sync" value={!syncStatus?.pendingChanges ? '✓ Live' : '⚠ Pending'}/>
            </div>
          </Section>

        </div>

        <div style={{ padding:'12px 18px', borderTop:'1px solid var(--bdr)', flexShrink:0 }}>
          <button onClick={() => { setAppMode('backoffice'); onClose(); }} style={{ width:'100%', padding:'10px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t2)', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            ⚙ Open Back Office
          </button>
        </div>
      </div>
    </>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>{label}</div>
      {children}
    </div>
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
function Alert({ color, text }) {
  return <div style={{ padding:'10px 12px', background:`var(--${color}-d,var(--bg3))`, borderRadius:10, border:`1px solid var(--${color}-b,var(--bdr))`, fontSize:11, color:`var(--${color},var(--t3))` }}>{text}</div>;
}
function Chip({ children, color='amber' }) {
  return <span style={{ fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:4, background:'var(--bg4)', color:'var(--t4)', border:'1px solid var(--bdr)' }}>{children}</span>;
}
