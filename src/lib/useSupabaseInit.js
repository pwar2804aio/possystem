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
import { supabase, isMock, getLocationId } from './supabase';
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
        useStore.setState({ menuItems: items.map(item => ({
          ...item,
          taxRateId:   item.tax_rate_id   ?? item.taxRateId   ?? null,
          taxOverrides: item.tax_overrides ?? item.taxOverrides ?? {},
        })) });
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

      // Resolve location ID (needed for tax rates + config push)
      const locId = await getLocationId().catch(() => null);

      // v4.6.33: hydrate printers from Supabase so POS devices see back-office
      // changes (including the cashDrawerAttached flag) on app load. Previously
      // the POS only ever saw printers if it was the same browser as the back
      // office — a cross-device install (Sunmi terminal + separate laptop for
      // back office) would never hydrate its own rpos-printers cache.
      if (locId && supabase) {
        try {
          const { data: prows } = await supabase
            .from('printers')
            .select('*')
            .eq('location_id', locId);
          if (Array.isArray(prows)) {
            const shaped = prows.map(r => ({
              id: r.id,
              name: r.name,
              model: r.meta?.model || 'sunmi-nt311',
              connectionType: r.connection || 'network',
              address: r.ip || '',
              port: r.port ?? 9100,
              paperWidth: r.paper_width ?? 80,
              roles: Array.isArray(r.meta?.roles) ? r.meta.roles : ['receipt'],
              location: r.meta?.location || '',
              status: r.meta?.status || 'unknown',
              addedAt: r.meta?.addedAt || Date.now(),
              cashDrawerAttached: !!r.meta?.cashDrawerAttached,
            }));
            localStorage.setItem('rpos-printers', JSON.stringify(shaped));
            // Fire the same event the back-office PrinterRegistry dispatches so
            // any subscribed code picks up the new list.
            window.dispatchEvent(new Event('rpos-printers-updated'));
          }
        } catch (err) {
          console.warn('[useSupabaseInit] printers hydration failed:', err?.message || err);
        }
      }

      // v4.6.35: hydrate cash drawers from Supabase
      try {
        await useStore.getState().loadCashDrawers?.();
      } catch (err) {
        console.warn('[useSupabaseInit] cashDrawers hydration failed:', err?.message || err);
      }

      // Tax rates for this location
      if (locId && supabase) {
        const { data: rates } = await supabase
          .from('tax_rates')
          .select('*')
          .eq('location_id', locId)
          .eq('active', true)
          .order('rate', { ascending: false });
        if (rates?.length) useStore.setState({ taxRates: rates.map(r => ({
          id: r.id, name: r.name, code: r.code,
          rate: parseFloat(r.rate), type: r.type,
          appliesTo: r.applies_to || ['all'],
          isDefault: r.is_default, active: r.active,
        })) });
      }

      // Latest config push
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
