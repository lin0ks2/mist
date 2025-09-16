/**
 * app.mistakes.js
 *
 * Компромисс:
 *  - Хранение: без авто-усушки; записи живут до ручной "Очистить".
 *  - UI (list/count/deck): показываем/считаем ТОЛЬКО "живые" ошибки (слово есть в исходном словаре).
 *
 * Бакет по языку интерфейса (App.settings.lang).
 * У каждой записи сохраняем язык словаря-источника (dl),
 * чтобы фильтровать по языку активного словаря, независимо от внешних событий.
 *
 * localStorage key: 'mistakes.v1'
 * Формат:
 * {
 *   <uiLang>: {
 *     <dictKey>: {
 *       <wordId>: { ts:<ms>, seen:<n>, dl:<dictLang|null> }
 *     }
 *   }
 * }
 */
(function(){
  var App = window.App || (window.App = {});
  var LS_KEY = 'mistakes.v1';
  var MAX_PER_LANG = null; // <- no-op: нет авто-усушки; поставить число, если когда-нибудь понадобится лимит

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
  function activeLang(){               // язык интерфейса (RU/UK/…)
    return (App.settings && App.settings.lang) || 'ru';
  }
  function langOfKey(dictKey){         // язык словаря-источника (de/en/…)
    try{
      if (App.Decks && App.Decks.langOfKey) return App.Decks.langOfKey(dictKey);
    }catch(e){}
    return null;
  }
  function targetLang(){               // язык ТЕКУЩЕГО активного словаря (если есть)
    try{
      var key = App.dictRegistry && App.dictRegistry.activeKey;
      if (key && key !== 'mistakes') return langOfKey(key) || null;
    }catch(e){}
    return null; // если активен 'mistakes' или активный словарь неизвестен — не фильтруем по словарному языку
  }
  function now(){ return Date.now ? Date.now() : (+new Date()); }

  function ensure(db, uiLang, dictKey){
    if (!db[uiLang]) db[uiLang] = {};
    if (!db[uiLang][dictKey]) db[uiLang][dictKey] = {};
    return db[uiLang][dictKey];
  }

  // no-op: не удаляем автоматически; только по кнопке "Очистить"
  function evictIfNeeded(db, uiLang){
    if (typeof MAX_PER_LANG === 'number' && MAX_PER_LANG >= 0) {
      // (опционально, если когда-нибудь включим лимит)
      var total=0, L=db[uiLang]||{};
      for (var k in L){ if (!L.hasOwnProperty(k)) continue;
        total += Object.keys(L[k]||{}).length;
      }
      if (total > MAX_PER_LANG) {
        var items=[];
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
          delete L[dk][id];
        }
      }
    }
    // по умолчанию: ничего не делаем
  }

  function resolveDeck(dictKey){
    if (App.Decks && App.Decks.resolveDeckByKey) return App.Decks.resolveDeckByKey(dictKey) || [];
    return [];
  }
  function indexDeckById(deck){
    var idx={};
    for (var i=0;i<deck.length;i++){ idx[String(deck[i].id)] = deck[i]; }
    return idx;
  }
  function wordExists(dictKey, wordId){
    var deck = resolveDeck(dictKey);
    if (!deck || !deck.length) return false;
    var id = String(wordId);
    // быстрая проверка без индекса (экономим память): линейный проход приемлем для предпросмотра
    for (var i=0;i<deck.length;i++){ if (String(deck[i].id) === id) return true; }
    return false;
  }

  // ---------- public API ----------
  App.Mistakes = {
    /**
     * Добавить/обновить ошибку.
     * Бакет = ТЕКУЩИЙ ЯЗЫК ИНТЕРФЕЙСА.
     * Сохраняем язык словаря-источника (dl) для фильтрации.
     */
    add: function(id, card, sourceKey){
      try{
        id = String(id);
        var dictKey = sourceKey || (card && card.sourceKey) || (App.dictRegistry && App.dictRegistry.activeKey) || null;
        if (!dictKey) return;

        var uiLang = activeLang();
        var dkLang = langOfKey(dictKey) || null;

        var db = load();
        var bucket = ensure(db, uiLang, dictKey);

        if (!bucket[id]) {
          bucket[id] = { ts: now(), seen: 1, dl: dkLang };
        } else {
          bucket[id].seen = (bucket[id].seen|0)+1;
          bucket[id].ts = now();
          if (dkLang) bucket[id].dl = dkLang;
        }

        evictIfNeeded(db, uiLang);
        save(db);
      }catch(e){}
    },

    /**
     * Список (превью) для ТЕКУЩЕГО UI-языка.
     * Фильтрация:
     *  - по языку активного словаря (если известен) — через entry.dl
     *  - по "живости": слово должно существовать в исходном словаре
     */
    list: function(){
      var uiLang = activeLang();
      var db = load();
      var L = db[uiLang] || {};
      var tLang = targetLang();

      var out=[];
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var map=L[dk]; if (!map) continue;
        for (var id in map){ if (!map.hasOwnProperty(id)) continue;
          var entry = map[id];
          if (tLang && entry && entry.dl && entry.dl !== tLang) continue;
          if (!wordExists(dk, id)) continue; // показываем только "живые"
          out.push({ id: id, dictKey: dk, ts: entry.ts||0 });
        }
      }
      out.sort(function(a,b){ return (b.ts|0) - (a.ts|0); });
      return out;
    },

    /**
     * Кол-во уникальных ошибок для ТЕКУЩЕГО UI-языка.
     * Считаем только "живые" записи и (если известен) только для языка активного словаря.
     */
    count: function(){
      var uiLang = activeLang();
      var db = load();
      var L = db[uiLang] || {};
      var tLang = targetLang();

      var total=0;
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var map=L[dk]; if (!map) continue;
        for (var id in map){ if (!map.hasOwnProperty(id)) continue;
          var entry = map[id];
          if (tLang && entry && entry.dl && entry.dl !== tLang) continue;
          if (!wordExists(dk, id)) continue; // считаем только "живые"
          total++;
        }
      }
      return total;
    },

    /**
     * Тренировочная колода для ТЕКУЩЕГО UI-языка.
     * Фильтруем по языку активного словаря (если известен) и по "живости".
     * Ничего из LS здесь не удаляем.
     */
    deck: function(){
      var uiLang = activeLang();
      var db = load();
      var L = db[uiLang] || {};
      var tLang = targetLang();

      var out=[];
      var perDictIndex = {};

      // Индексируем только используемые словари (для ускорения сборки колоды)
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var deck = resolveDeck(dk);
        if (!deck || !deck.length) continue;
        perDictIndex[dk] = indexDeckById(deck);
      }

      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var idx = perDictIndex[dk]; if (!idx) continue;
        var map=L[dk];
        for (var id in map){ if (!map.hasOwnProperty(id)) continue;
          var entry = map[id];
          if (tLang && entry && entry.dl && entry.dl !== tLang) continue;
          var w = idx[String(id)];
          if (!w) continue; // "битые" не подаём в тренировку, но из LS не трогаем
          var ww = Object.assign({}, w);
          ww._mistakeSourceKey = dk;
          out.push(ww);
        }
      }

      // Сортировка по "свежести"
      out.sort(function(a,b){
        var eA = (L[a._mistakeSourceKey]||{})[String(a.id)];
        var eB = (L[b._mistakeSourceKey]||{})[String(b.id)];
        var ta = eA?eA.ts:0, tb = eB?eB.ts:0;
        return (tb|0) - (ta|0);
      });
      return out;
    },

    /** Словарь-источник для id (в ТЕКУЩЕМ UI-бакете). */
    sourceKeyFor: function(id){
      var uiLang = activeLang();
      var db = load();
      var L = db[uiLang] || {};
      id = String(id);
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        if (L[dk] && L[dk][id]) return dk;
      }
      return null;
    },

    /** Очистить ошибки для ТЕКУЩЕГО UI-языка полностью (по кнопке). */
    clearActive: function(){
      var uiLang = activeLang();
      var db = load();
      if (db[uiLang]) { db[uiLang] = {}; save(db); }
    },

    /** Отметить показ карточки (обновить recency). */
    onShow: function(id){
      var uiLang = activeLang();
      var db = load();
      var L = db[uiLang] || {};
      id = String(id);
      for (var dk in L){ if (!L.hasOwnProperty(dk)) continue;
        var m=L[dk];
        if (m && m[id]) { m[id].ts = now(); break; }
      }
      save(db);
    }
  };
})();
