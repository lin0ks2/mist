
/**
 * app.mistakes.js
 * Aggregates user's mistakes per language across all dictionaries of that language.
 * Storage format (localStorage key 'mistakes.v1'):
 * { <lang>: { <dictKey>: { <wordId>: { ts:<ms>, seen:<n> } } } }
 */
(function(){
  var App = window.App || (window.App = {});
  var LS_KEY = 'mistakes.v1';
  var MAX_PER_LANG = 1000; // cap to keep LS bounded

  function load(){
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(e){ return {}; }
  }
  function save(db){
    try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch(e){}
  }
  function langOfKey(dictKey){
    try {
      if (App.Decks && App.Decks.langOfKey) return App.Decks.langOfKey(dictKey);
    } catch(e){}
    // fallback to current settings
    return (App.settings && App.settings.lang) || 'ru';
  }
  function activeLang(){
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
    var items=[];
    var L=db[lang]||{};
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
  function indexDeckById(deck){
    var idx={};
    for (var i=0;i<deck.length;i++){
      var w=deck[i]; idx[String(w.id)]=w;
    }
    return idx;
  }

  App.Mistakes = {
    add: function(id, card, sourceKey){
      try{
        id = String(id);
        var dictKey = sourceKey || (card && card.sourceKey) || (App.dictRegistry && App.dictRegistry.activeKey) || null;
        if (!dictKey){ return; }
        var lang = langOfKey(dictKey);
        var db = load();
        var bucket = ensure(db, lang, dictKey);
        if (!bucket[id]) bucket[id] = { ts: now(), seen: 1 };
        else { bucket[id].seen = (bucket[id].seen|0)+1; bucket[id].ts = now(); }
        evictIfNeeded(db, lang);
        save(db);
      }catch(e){}
    },
    list: function(){
      var lang = activeLang();
      var db = load();
      var L = db[lang] || {};
      var out=[];
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var m=L[dk];
        for (var id in m){ if (!m.hasOwnProperty(id)) continue;
          out.push({ id: id, dictKey: dk, ts: m[id].ts||0 });
        }
      }
      out.sort(function(a,b){ return (b.ts|0) - (a.ts|0); });
      return out;
    },
    count: function(){
      var lang = activeLang();
      var db = load();
      return totalCountForLang(db, lang);
    },
    deck: function(){
      var lang = activeLang();
      var db = load();
      var L = db[lang] || {};
      var out=[];
      var perDictIndex = {};
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var deck = resolveDeck(dk);
        if (!deck || !deck.length) continue;
        perDictIndex[dk] = indexDeckById(deck);
      }
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var idx = perDictIndex[dk];
        if (!idx) continue;
        var m = L[dk];
        for (var id in m){ if (!m.hasOwnProperty(id)) continue;
          var w = idx[id];
          if (w){
            var ww = Object.assign({}, w);
            ww._mistakeSourceKey = dk;
            out.push(ww);
          }else{
            delete db[lang][dk][id];
          }
        }
      }
      if (out.length) save(db);
      out.sort(function(a,b){
        var A = (L[a._mistakeSourceKey]||{})[String(a.id)];
        var B = (L[b._mistakeSourceKey]||{})[String(b.id)];
        var ta = A?A.ts:0, tb = B?B.ts:0;
        return (tb|0) - (ta|0);
      });
      return out;
    },
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
    clearActive: function(){
      var lang = activeLang();
      var db = load();
      if (db[lang]) { db[lang] = {}; save(db); }
    },
    onShow: function(id){
      var lang = activeLang();
      var db = load();
      var L = db[lang] || {};
      id = String(id);
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var m=L[dk];
        if (m && m[id]) { m[id].ts = Date.now ? Date.now() : (+new Date()); break; }
      }
      save(db);
    }
  };
})();
