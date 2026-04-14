import { useState, useEffect } from 'react';
import { supabase, isMock } from '../lib/supabase';

export default function LocationSwitcher({ onClose }) {
  const [org, setOrg] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(null);

  const currentLocationId = (() => {
    try { return JSON.parse(localStorage.getItem('rpos-bo-location') || 'null') || null; } catch { return null; }
  })();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get user profile to find org
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id, location_id')
        .eq('id', user.id)
        .single();

      if (!profile?.org_id) { setLoading(false); return; }

      // Get org details
      const { data: orgData } = await supabase
        .from('organisations')
        .select('id, name')
        .eq('id', profile.org_id)
        .single();
      setOrg(orgData);

      // Get locations user has access to via user_locations
      const { data: userLocs } = await supabase
        .from('user_locations')
        .select('location_id')
        .eq('user_id', user.id);

      // Also include their primary location_id
      const accessIds = new Set([
        ...(userLocs || []).map(ul => ul.location_id),
        profile.location_id,
      ].filter(Boolean));

      if (accessIds.size === 0) {
        // Fall back: show all org locations
        const { data: allLocs } = await supabase
          .from('locations')
          .select('id, name, address, timezone')
          .eq('org_id', profile.org_id)
          .order('name');
        setLocations(allLocs || []);
      } else {
        const { data: locs } = await supabase
          .from('locations')
          .select('id, name, address, timezone')
          .in('id', [...accessIds])
          .order('name');
        setLocations(locs || []);
      }
    } catch(e) { console.error('[LocationSwitcher]', e); }
    setLoading(false);
  };

  const switchTo = async (loc) => {
    setSwitching(loc.id);
    // Store the selected location so BackOfficeApp uses it on reload
    localStorage.setItem('rpos-bo-location', JSON.stringify(loc.id));
    // Update user profile primary location
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_profiles')
          .update({ location_id: loc.id })
          .eq('id', user.id);
      }
    } catch {}
    // Reload to apply new location
    window.location.reload();
  };

  const currentLoc = locations.find(l => l.id === currentLocationId);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
        backdropFilter:'blur(4px)', zIndex:9998,
      }} />

      {/* Modal */}
      <div style={{
        position:'fixed', top:'50%', left:'50%',
        transform:'translate(-50%,-50%)',
        zIndex:9999,
        width:420, maxWidth:'90vw',
        background:'var(--bg1)',
        border:'1px solid var(--bdr)',
        borderRadius:16,
        boxShadow:'0 24px 80px rgba(0,0,0,0.5)',
        overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding:'20px 24px 16px',
          borderBottom:'1px solid var(--bdr)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>
              Switch location
            </div>
            <div style={{ fontSize:17, fontWeight:800, color:'var(--t1)' }}>
              {loading ? '…' : org?.name || 'Your organisation'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'var(--bg3)', border:'1px solid var(--bdr)',
            borderRadius:8, width:32, height:32, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:16, color:'var(--t3)', fontFamily:'inherit',
          }}>✕</button>
        </div>

        {/* Locations list */}
        <div style={{ padding:'12px 16px 20px' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--t4)', fontSize:13 }}>
              Loading locations…
            </div>
          ) : locations.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--t4)', fontSize:13 }}>
              No locations found for your account
            </div>
          ) : (
            locations.map(loc => {
              const isCurrent = loc.id === (currentLocationId || locations[0]?.id);
              const isLoading = switching === loc.id;
              return (
                <button key={loc.id} onClick={() => !isCurrent && switchTo(loc)}
                  disabled={isCurrent || !!switching}
                  style={{
                    width:'100%', textAlign:'left',
                    padding:'14px 16px',
                    marginBottom:8, borderRadius:12,
                    border:`1.5px solid ${isCurrent ? 'var(--acc-b)' : 'var(--bdr)'}`,
                    background: isCurrent ? 'var(--acc-d)' : 'var(--bg3)',
                    cursor: isCurrent ? 'default' : 'pointer',
                    fontFamily:'inherit',
                    transition:'all .12s',
                    display:'flex', alignItems:'center', gap:14,
                    opacity: switching && !isLoading ? 0.5 : 1,
                  }}>
                  {/* Icon */}
                  <div style={{
                    width:36, height:36, borderRadius:10, flexShrink:0,
                    background: isCurrent ? 'var(--acc)' : 'var(--bg)',
                    border:`1px solid ${isCurrent ? 'var(--acc-b)' : 'var(--bdr)'}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:18,
                  }}>📍</div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{
                      fontSize:14, fontWeight:700,
                      color: isCurrent ? 'var(--acc)' : 'var(--t1)',
                      marginBottom:2,
                    }}>{loc.name}</div>
                    {loc.address && (
                      <div style={{ fontSize:12, color:'var(--t4)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {loc.address}
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  {isCurrent && (
                    <span style={{
                      fontSize:11, fontWeight:700, padding:'3px 8px',
                      borderRadius:20, background:'var(--acc)', color:'#fff',
                      flexShrink:0,
                    }}>Active</span>
                  )}
                  {isLoading && (
                    <span style={{ fontSize:12, color:'var(--t4)', flexShrink:0 }}>Switching…</span>
                  )}
                  {!isCurrent && !isLoading && (
                    <span style={{ fontSize:16, color:'var(--t4)', flexShrink:0 }}>→</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {currentLoc && (
          <div style={{
            padding:'10px 24px 14px',
            borderTop:'1px solid var(--bdr)',
            fontSize:11, color:'var(--t4)', textAlign:'center',
          }}>
            Currently managing <strong style={{ color:'var(--t3)' }}>{currentLoc.name}</strong>
          </div>
        )}
      </div>
    </>
  );
}
