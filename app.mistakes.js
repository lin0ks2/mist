/**
 * app.mistakes.js
 * Mistakes are bucketed STRICTLY by current UI language (App.settings.lang),
 * and UI (list/count/deck) additionally filters by the TARGET dictionary language
 * of the active dictionary (via App.Decks.langOfKey(App.dictRegistry.activeKey)).
 *
 * localStorage key: 'mistakes.v1'
 * Structure:
 * {
 *   <uiLang>: {
 *     <dictKey>: {
 *       <wordId>: { ts:<ms>, seen:<n> }
 *     }
 *   }
 * }
 */
(function(){
  var App = window.App || (window.App = {});
  var LS_KEY = 'mistakes.v1';
  var LAST_TLANG_KEY = 'mistakes.lastTargetLang';
  var MAX_PER_LANG = 1000; // safety cap per UI language

  // ---------- utils ----------
  function load(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
  }
  function save(db){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(db)); }catch(e){}
  }
  function activeLang(){ // UI language is the bucket key
    return (App.settings && App.settings.lang) || 'ru';
  }
  function now(){ return Date.now ? Date.now() : (+new Date()); }

  function ensure(db, lang, dictKey){
    if (!db[lang]) db[lang] = {};
    if (!db[lang][dictKey]) db[lang][dictKey] = {};
    return db[lang][dictKey];
  }

  function totalCountForLang(db, lang){
    var total=0, L=db[lang]||{};
    for (var k in L){ if (!L.hasOwnProperty(k)) continue;
      total += Object.keys(L[k]||{}).length;
    }
    return total;
  }

  function evictIfNeeded(db, lang){
    var total = totalCountForLang(db, lang);
    if (total <= MAX_PER_LANG) return;
    var items=[], L=db[lang]||{};
    for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
      var map=L[dk];
      for (var id in map){ if (!map.hasOwnProperty(id)) continue;
        items.push([dk, id, map[id].ts||0]);
      }
    }
    // oldest first
    items.sort(function(a,b){ return (a[2]|0) - (b[2]|0); });
    var toDrop = total - MAX_PER_LANG;
    for (var i=0; i<toDrop && i<items.length; i++){
      var dk = items[i][0], id = items[i][1];
      delete L[dk][id];
    }
  }

  function resolveDeck(dictKey){
    if (App.Decks && App.Decks.resolveDeckByKey) {
      return App.Decks.resolveDeckByKey(dictKey) || [];
    }
    return [];
  }
  function langOfKey(dictKey){
    try{
      if (App.Decks && App.Decks.langOfKey) return App.Decks.langOfKey(dictKey);
    }catch(e){}
    return null;
  }

  // Determine CURRENT TARGET dictionary language (the language of the active dictionary).
  // If activeKey is 'mistakes', fallback to the last remembered target language.
  function targetLang(){
    try{
      var key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
      if (key && key !== 'mistakes'){
        var tl = langOfKey(key);
        if (tl){
          try { localStorage.setItem(LAST_TLANG_KEY, tl); } catch(e){}
          return tl;
        }
      }
    }catch(e){}
    // fallback to last known
    try{
      var tl2 = localStorage.getItem(LAST_TLANG_KEY);
      if (tl2) return tl2;
    }catch(e){}
    return null;
  }

  // Track changes from UI (optional, если у тебя кидается это событие)
  try {
    document.addEventListener('dict:title:updated', function(ev){
      try{
        var key = ev && ev.detail && ev.detail.key;
        var tl = key ? langOfKey(key) : null;
        if (tl) localStorage.setItem(LAST_TLANG_KEY, tl);
      }catch(_){}
    });
  } catch(_){}

  function indexDeckById(deck){
    var idx={};
    for (var i=0;i<deck.length;i++){ idx[String(deck[i].id)] = deck[i]; }
    return idx;
  }

  // ---------- public API ----------
  App.Mistakes = {
    /**
     * Add/refresh a mistake.
     * IMPORTANT: mistakes are bucketed by CURRENT UI language ONLY.
     */
    add: function(id, card, sourceKey){
      try{
        id = String(id);
        var dictKey = sourceKey || (card && card.sourceKey) || (App.dictRegistry && App.dictRegistry.activeKey) || null;
        if (!dictKey) return;

        var lang = activeLang(); // <-- ключевой момент: всегда язык интерфейса
        var db = load();
        var bucket = ensure(db, lang, dictKey);

        if (!bucket[id]) bucket[id] = { ts: now(), seen: 1 };
        else { bucket[id].seen = (bucket[id].seen|0)+1; bucket[id].ts = now(); }

        evictIfNeeded(db, lang);
        save(db);
      }catch(e){}
    },

    /** Preview list for CURRENT UI language, filtered by CURRENT TARGET dict language (if known). */
    list: function(){
      var lang = activeLang();
      var db = load();
      var L = db[lang] || {};
      var tLang = targetLang();

      var out=[];
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var dkLang = langOfKey(dk);
        if (tLang && dkLang && dkLang !== tLang) continue; // фильтр по языку словаря
        var m=L[dk];
        for (var id in m){ if (!m.hasOwnProperty(id)) continue;
          out.push({ id: id, dictKey: dk, ts: m[id].ts||0 });
        }
      }
      out.sort(function(a,b){ return (b.ts|0) - (a.ts|0); });
      return out;
    },

    /** Count unique mistakes for CURRENT UI language, filtered by CURRENT TARGET dict language. */
    count: function(){
      var lang = activeLang();
      var db = load();
      var L = db[lang] || {};
      var tLang = targetLang();

      var total=0;
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var dkLang = langOfKey(dk);
        if (tLang && dkLang && dkLang !== tLang) continue;
        total += Object.keys(L[dk]||{}).length;
      }
      return total;
    },

    /**
     * Build training deck for CURRENT UI language, filtered by CURRENT TARGET dict language.
     * Also removes stale ids that no longer exist in their source dictionaries.
     */
    deck: function(){
      var lang = activeLang();
      var db = load();
      var L = db[lang] || {};
      var tLang = targetLang();

      var out=[];
      var perDictIndex = {};

      // Build per-dict index for dicts that match targetLang (if known)
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var dkLang = langOfKey(dk);
        if (tLang && dkLang && dkLang !== tLang) continue;
        var deck = resolveDeck(dk);
        if (!deck || !deck.length) continue;
        perDictIndex[dk] = indexDeckById(deck);
      }

      // Validate & collect
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        if (!perDictIndex[dk]) continue; // filtered out or empty dict
        var idx = perDictIndex[dk];
        var m = L[dk];
        for (var id in m){ if (!m.hasOwnProperty(id)) continue;
          var w = idx[id];
          if (w){
            var ww = Object.assign({}, w);
            ww._mistakeSourceKey = dk;
            out.push(ww);
          }else{
            // stale -> drop it
            delete L[dk][id];
          }
        }
      }
      if (out.length) save(db);

      // newest first
      out.sort(function(a,b){
        // guard if L[dk] changed above
        var Amap = L[a._mistakeSourceKey] || {};
        var Bmap = L[b._mistakeSourceKey] || {};
        var A = Amap[String(a.id)], B = Bmap[String(b.id)];
        var ta = A?A.ts:0, tb = B?B.ts:0;
        return (tb|0) - (ta|0);
      });
      return out;
    },

    /** Original source dict for id (CURRENT UI language bucket only). */
    sourceKeyFor: function(id){
      var lang = activeLang();
      var db = load();
      var L = db[lang] || {};
      id = String(id);
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        if (L[dk] && L[dk][id]) return dk;
      }
      return null;
    },

    /** Clear mistakes for CURRENT UI language only. */
    clearActive: function(){
      var lang = activeLang();
      var db = load();
      if (db[lang]) { db[lang] = {}; save(db); }
    },

    /** Called when a mistake card is shown (bumps recency). */
    onShow: function(id){
      var lang = activeLang();
      var db = load();
      var L = db[lang] || {};
      id = String(id);
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var m=L[dk];
        if (m && m[id]) { m[id].ts = now(); break; }
      }
      save(db);
    }
  };
})();
