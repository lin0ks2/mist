/**
 * app.mistakes.js
 * Mistakes are collected STRICTLY per current UI language (App.settings.lang),
 * aggregated across all dictionaries of that language.
 * Storage (localStorage 'mistakes.v1'):
 * { <lang>: { <dictKey>: { <wordId>: { ts:<ms>, seen:<n> } } } }
 */
(function(){
  var App = window.App || (window.App = {});
  var LS_KEY = 'mistakes.v1';
  var MAX_PER_LANG = 1000; // safety cap per language

  function load(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
  }
  function save(db){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(db)); }catch(e){}
  }
  function activeLang(){
    // current UI language is the single source of truth
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
      var m=L[k];
      total += Object.keys(m||{}).length;
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
    items.sort(function(a,b){ return (a[2]|0) - (b[2]|0); });
    var toDrop = total - MAX_PER_LANG;
    for (var i=0; i<toDrop && i<items.length; i++){
      var dk = items[i][0], id = items[i][1];
      delete db[lang][dk][id];
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
  function indexDeckById(deck){
    var idx={};
    for (var i=0;i<deck.length;i++){ idx[String(deck[i].id)] = deck[i]; }
    return idx;
  }

  App.Mistakes = {
    /**
     * Add/refresh a mistake.
     * IMPORTANT: we always bucket by current UI language (activeLang()),
     * so mistakes never mix across languages.
     */
    add: function(id, card, sourceKey){
      try{
        id = String(id);
        var lang = activeLang();
        // Source dictKey is still stored on the leaf for retrieval, but language is taken from UI.
        var dictKey = sourceKey || (card && card.sourceKey) || (App.dictRegistry && App.dictRegistry.activeKey) || null;
        if (!dictKey) return;

        var db = load();
        var bucket = ensure(db, lang, dictKey);
        if (!bucket[id]) bucket[id] = { ts: now(), seen: 1 };
        else { bucket[id].seen = (bucket[id].seen|0)+1; bucket[id].ts = now(); }
        evictIfNeeded(db, lang);
        save(db);
      }catch(e){}
    },

    /** Preview list for CURRENT language only (id + dictKey), newest first. */
    list: function(){
      var lang = activeLang();
      var db = load();
      var L = db[lang] || {};
      var out=[];
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        // hard filter by dict language: only dicts of CURRENT lang
        if (langOfKey(dk) && langOfKey(dk) !== lang) continue;
        var m=L[dk];
        for (var id in m){ if (!m.hasOwnProperty(id)) continue;
          out.push({ id: id, dictKey: dk, ts: m[id].ts||0 });
        }
      }
      out.sort(function(a,b){ return (b.ts|0) - (a.ts|0); });
      return out;
    },

    /** Count unique mistakes for CURRENT language only. */
    count: function(){
      var lang = activeLang();
      var db = load();
      var L = db[lang] || {};
      var total=0;
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        if (langOfKey(dk) && langOfKey(dk) !== lang) continue;
        total += Object.keys(L[dk]||{}).length;
      }
      return total;
    },

    /**
     * Build training deck for CURRENT language from all dicts of that language.
     * Cleans stale ids and skips dicts of other languages defensively.
     */
    deck: function(){
      var lang = activeLang();
      var db = load();
      var L = db[lang] || {};
      var out=[];
      var perDictIndex = {};

      // Build per-dict index for dicts of CURRENT language
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var dkLang = langOfKey(dk);
        if (dkLang && dkLang !== lang) continue;
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
            delete db[lang][dk][id];
          }
        }
      }
      if (out.length) save(db);

      // newest first
      out.sort(function(a,b){
        var A = (L[a._mistakeSourceKey]||{})[String(a.id)];
        var B = (L[b._mistakeSourceKey]||{})[String(b.id)];
        var ta = A?A.ts:0, tb = B?B.ts:0;
        return (tb|0) - (ta|0);
      });
      return out;
    },

    /** Original source dict for id (CURRENT language bucket only). */
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

    /** Clear mistakes for CURRENT language only. */
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
