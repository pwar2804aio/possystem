// ============================================================
// src/lib/i18n.js — Kiosk-facing internationalisation (v5.5.18)
// ============================================================
// Lightweight translator with no external deps. Language is held
// in module state, persisted to localStorage, and React components
// subscribe via the useKioskLang() hook to re-render on change.
//
// Strings live in a single STRINGS map keyed by language code.
// English is fully populated; other languages currently fall back
// to English silently. Add translations incrementally.
//
// Today only ScreenOrderType + ScreenLanguagePicker use t(); other
// kiosk screens can be migrated screen-by-screen.
// ============================================================

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'rpos-kiosk-lang';
const DEFAULT_LANG = 'en';

// Languages we expose in the picker. Add codes here when more
// translations are populated.
export const LANGUAGES = [
  { code: 'en', name: 'English',  nativeName: 'English',    flag: '🇬🇧' },
  { code: 'es', name: 'Spanish',  nativeName: 'Español',    flag: '🇪🇸' },
  { code: 'fr', name: 'French',   nativeName: 'Français',   flag: '🇫🇷' },
  { code: 'de', name: 'German',   nativeName: 'Deutsch',    flag: '🇩🇪' },
  { code: 'it', name: 'Italian',  nativeName: 'Italiano',   flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
];

// Translation strings. Nested with dot-keys for clarity:
//   t('orderType.title') etc.
//
// Untranslated keys fall back to English. Missing English keys
// fall back to the raw key (loud + obvious so we notice).
const STRINGS = {
  en: {
    'orderType.title': 'Where will you be eating today?',
    'orderType.eatIn': 'Eat in',
    'orderType.eatIn.subtitle': 'Served to your table',
    'orderType.takeaway': 'Take away',
    'orderType.takeaway.subtitle': 'Collect at the counter',
    'tableNumber.title': 'Enter your table number',
    'tableNumber.placeholder': 'Table number',
    'tableNumber.delete': 'Delete',
    'tableNumber.continue': 'Continue',
    'menu.add': 'Add',
    'menu.currentOrder': 'Current order',
    'menu.goToCheckout': 'Go to checkout',
    'menu.itemSingular': 'item',
    'menu.itemPlural': 'items',
    'menu.empty': 'No items in this category.',
    'menu.noCategories': 'No categories on this menu yet.',
    'menu.allergens.tap': 'Have allergies? Tap to filter the menu',
    'menu.allergens.avoiding': 'Avoiding',
    'menu.allergens.unsafeFaded': 'unsafe items shown faded',
    'language.choose': 'Choose your language',
    'language.close': 'Close',
    'common.back': 'Back',
  },
  es: {
    'orderType.title': '¿Dónde vas a comer hoy?',
    'orderType.eatIn': 'Comer aquí',
    'orderType.eatIn.subtitle': 'Servido en tu mesa',
    'orderType.takeaway': 'Para llevar',
    'orderType.takeaway.subtitle': 'Recoger en el mostrador',
    'tableNumber.title': 'Introduce el número de tu mesa',
    'tableNumber.placeholder': 'Número de mesa',
    'tableNumber.delete': 'Borrar',
    'tableNumber.continue': 'Continuar',
    'menu.add': 'Añadir',
    'menu.currentOrder': 'Pedido actual',
    'menu.goToCheckout': 'Ir al pago',
    'menu.itemSingular': 'artículo',
    'menu.itemPlural': 'artículos',
    'menu.empty': 'No hay artículos en esta categoría.',
    'menu.noCategories': 'Aún no hay categorías en este menú.',
    'menu.allergens.tap': '¿Tienes alergias? Toca para filtrar el menú',
    'menu.allergens.avoiding': 'Evitando',
    'menu.allergens.unsafeFaded': 'los artículos no seguros se muestran atenuados',
    'language.choose': 'Elige tu idioma',
    'language.close': 'Cerrar',
    'common.back': 'Atrás',
  },
  fr: {
    'orderType.title': 'Où allez-vous manger aujourd\u2019hui ?',
    'orderType.eatIn': 'Sur place',
    'orderType.eatIn.subtitle': 'Servi à votre table',
    'orderType.takeaway': 'À emporter',
    'orderType.takeaway.subtitle': 'À récupérer au comptoir',
    'tableNumber.title': 'Entrez votre numéro de table',
    'tableNumber.placeholder': 'Numéro de table',
    'tableNumber.delete': 'Effacer',
    'tableNumber.continue': 'Continuer',
    'menu.add': 'Ajouter',
    'menu.currentOrder': 'Commande en cours',
    'menu.goToCheckout': 'Passer au paiement',
    'menu.itemSingular': 'article',
    'menu.itemPlural': 'articles',
    'menu.empty': 'Aucun article dans cette catégorie.',
    'menu.noCategories': 'Aucune catégorie sur ce menu pour le moment.',
    'menu.allergens.tap': 'Des allergies ? Touchez pour filtrer le menu',
    'menu.allergens.avoiding': 'Éviter',
    'menu.allergens.unsafeFaded': 'les articles non sûrs sont atténués',
    'language.choose': 'Choisissez votre langue',
    'language.close': 'Fermer',
    'common.back': 'Retour',
  },
  de: {
    'orderType.title': 'Wo werden Sie heute essen?',
    'orderType.eatIn': 'Hier essen',
    'orderType.eatIn.subtitle': 'An Ihren Tisch serviert',
    'orderType.takeaway': 'Zum Mitnehmen',
    'orderType.takeaway.subtitle': 'An der Theke abholen',
    'tableNumber.title': 'Geben Sie Ihre Tischnummer ein',
    'tableNumber.placeholder': 'Tischnummer',
    'tableNumber.delete': 'Löschen',
    'tableNumber.continue': 'Weiter',
    'menu.add': 'Hinzufügen',
    'menu.currentOrder': 'Aktuelle Bestellung',
    'menu.goToCheckout': 'Zur Kasse',
    'menu.itemSingular': 'Artikel',
    'menu.itemPlural': 'Artikel',
    'menu.empty': 'Keine Artikel in dieser Kategorie.',
    'menu.noCategories': 'Noch keine Kategorien in diesem Menü.',
    'menu.allergens.tap': 'Allergien? Tippen Sie, um das Menü zu filtern',
    'menu.allergens.avoiding': 'Vermeiden',
    'menu.allergens.unsafeFaded': 'unsichere Artikel werden ausgeblendet',
    'language.choose': 'Wählen Sie Ihre Sprache',
    'language.close': 'Schließen',
    'common.back': 'Zurück',
  },
  it: {
    'orderType.title': 'Dove mangerai oggi?',
    'orderType.eatIn': 'Mangia qui',
    'orderType.eatIn.subtitle': 'Servito al tuo tavolo',
    'orderType.takeaway': 'Da asporto',
    'orderType.takeaway.subtitle': 'Ritira al banco',
    'tableNumber.title': 'Inserisci il numero del tuo tavolo',
    'tableNumber.placeholder': 'Numero del tavolo',
    'tableNumber.delete': 'Elimina',
    'tableNumber.continue': 'Continua',
    'menu.add': 'Aggiungi',
    'menu.currentOrder': 'Ordine attuale',
    'menu.goToCheckout': 'Vai al pagamento',
    'menu.itemSingular': 'articolo',
    'menu.itemPlural': 'articoli',
    'menu.empty': 'Nessun articolo in questa categoria.',
    'menu.noCategories': 'Ancora nessuna categoria in questo menu.',
    'menu.allergens.tap': 'Hai allergie? Tocca per filtrare il menu',
    'menu.allergens.avoiding': 'Evitando',
    'menu.allergens.unsafeFaded': 'gli articoli non sicuri sono attenuati',
    'language.choose': 'Scegli la tua lingua',
    'language.close': 'Chiudi',
    'common.back': 'Indietro',
  },
  pt: {
    'orderType.title': 'Onde vai comer hoje?',
    'orderType.eatIn': 'Comer aqui',
    'orderType.eatIn.subtitle': 'Servido à sua mesa',
    'orderType.takeaway': 'Para levar',
    'orderType.takeaway.subtitle': 'Recolher ao balcão',
    'tableNumber.title': 'Insira o número da sua mesa',
    'tableNumber.placeholder': 'Número da mesa',
    'tableNumber.delete': 'Apagar',
    'tableNumber.continue': 'Continuar',
    'menu.add': 'Adicionar',
    'menu.currentOrder': 'Pedido atual',
    'menu.goToCheckout': 'Ir para pagamento',
    'menu.itemSingular': 'item',
    'menu.itemPlural': 'itens',
    'menu.empty': 'Sem artigos nesta categoria.',
    'menu.noCategories': 'Ainda não há categorias neste menu.',
    'menu.allergens.tap': 'Tem alergias? Toque para filtrar o menu',
    'menu.allergens.avoiding': 'A evitar',
    'menu.allergens.unsafeFaded': 'artigos inseguros aparecem esbatidos',
    'language.choose': 'Escolha o seu idioma',
    'language.close': 'Fechar',
    'common.back': 'Voltar',
  },
};

// ----- module state + subscribers -----
let _lang = (() => {
  try {
    const stored = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    if (stored && STRINGS[stored]) return stored;
  } catch { /* localStorage may be blocked */ }
  return DEFAULT_LANG;
})();

const _subs = new Set();

export function getLang() {
  return _lang;
}

export function setLang(code) {
  if (!STRINGS[code]) {
    console.warn('[i18n] unknown language code, ignoring:', code);
    return;
  }
  if (code === _lang) return;
  _lang = code;
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* noop */ }
  _subs.forEach(fn => { try { fn(); } catch (e) { console.error('[i18n] subscriber threw', e); } });
}

export function t(key, lang) {
  const useLang = lang || _lang;
  const langDict = STRINGS[useLang] || STRINGS[DEFAULT_LANG];
  if (langDict && langDict[key] != null) return langDict[key];
  // Fall back to English
  const enDict = STRINGS[DEFAULT_LANG] || {};
  if (enDict[key] != null) return enDict[key];
  // Loud fallback: return raw key so missing strings are visible
  return key;
}

export function getLanguageMeta(code) {
  return LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
}

// ----- React hook -----
// Causes the calling component to re-render when language changes.
// Uses useSyncExternalStore (the React 18+ idiom for subscribing
// React renders to a non-React store), which sidesteps the
// set-state-in-effect class of warnings + races on mount.
function _subscribe(fn) {
  _subs.add(fn);
  return () => { _subs.delete(fn); };
}
function _getSnapshot() { return _lang; }
export function useKioskLang() {
  return useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);
}
