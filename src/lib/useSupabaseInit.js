/**
 * useSupabaseInit — loads shared state from Supabase on app start.
 *
 * In mock mode: does nothing (BroadcastChannel + localStorage handles it).
 * In production: fetches the current state from DB and hydrates the store.
 *
 * Called once from App.jsx on mount.
 */

import { useEffect } from 'react';
import { useStore } from '../store';
import { isMock, getLocationId } from './supabase';
import {
  fetchMenuItems, fetchFloorPlan, fetch86List,
  fetchKDSTickets, fetchClosedChecks, fetchLatestConfigPush,
} from './db';
import { getLocationConfig, getBusinessDayStart } from './locationTime';

export default function useSupabaseInit() {
  const { menuItems, setMenuItems } = useStore.getState?.() || {};

  useEffect(() => {
    if (isMock) return;

    async function init() {
      const store = useStore.getState();

      // Load location config first — needed for timezone-correct reporting
      const locConfig = await getLocationConfig();
      const todayStart = getBusinessDayStart(locConfig);

      // Store config in Zustand so components can access it
      useStore.setState({ locationConfig: locConfig });

      // Menu items
      const { data: items } = await fetchMenuItems();
      if (items?.length) {
        useStore.setState({ menuItems: items });
      }

      // Floor plan + sections
      const { data: fp } = await fetchFloorPlan();
      if (fp?.tables?.length) {
        const current = useStore.getState().tables;
        const merged = fp.tables.map(dbT => {
          const live = current.find(t => t.id === dbT.id);
          return live
            ? { ...live, label:dbT.label, x:dbT.x, y:dbT.y, w:dbT.w, h:dbT.h, shape:dbT.shape, maxCovers:dbT.max_covers, section:dbT.section_id }
            : { id:dbT.id, label:dbT.label, x:dbT.x, y:dbT.y, w:dbT.w, h:dbT.h, shape:dbT.shape, maxCovers:dbT.max_covers, section:dbT.section_id, status:'available', session:null };
        });
        useStore.setState({ tables: merged });
      }
      if (fp?.sections?.length) {
        useStore.setState({
          locationSections: fp.sections.map(s => ({ id:s.id, label:s.label, color:s.color, icon:s.icon }))
        });
      }

      // 86 list
      const { data: e86 } = await fetch86List();
      if (e86) {
        useStore.setState({ eightySixIds: e86.map(r => r.item_id) });
      }

      // Active KDS tickets
      const { data: tickets } = await fetchKDSTickets();
      if (tickets) {
        useStore.setState({ kdsTickets: tickets });
      }

      // Today's closed checks — scoped to business day start in location timezone
      const { data: checks } = await fetchClosedChecks(undefined, 500, todayStart);
      if (checks) {
        useStore.setState({ closedChecks: checks });
      }

      // Latest config push
      const locId = await getLocationId().catch(() => null);
      const { data: push } = await fetchLatestConfigPush(locId);
      if (push?.snapshot) {
        const currentVersion = parseInt(sessionStorage.getItem('rpos-config-version') || '0');
        if (push.snapshot.version > currentVersion) {
          useStore.getState().setConfigUpdate(push.snapshot);
        }
      }

      console.info('[Supabase] Initialised — data loaded from DB');
    }

    init().catch(err => console.warn('[Supabase] Init failed:', err));
  }, []);
}
