// i18n.js v1.3.2
window.I18N = {
  ru: {
    appTitle:'Lexitron', tagline:'Он научит!',
    modalTitle:'Словари', langLabel:'Язык',
    repeatLabel:'Сложность', themeLabel:'Тема', ok:'OK',
    choose:'Выберите перевод', iDontKnow:'Не знаю',
    totalWords:'Всего слов в словаре', learned:'Выучено', errors:'Ошибок',
    dictsHeader:'Словари',
    mistakesName: 'Мои ошибки',
    pos_verbs:'Глаголы', pos_nouns:'Существительные', pos_preps:'Предлоги',
    pos_adjs:'Прилагательные', pos_advs:'Наречия', pos_misc:'Словарь',
    favTitle:'Избранное', ttPreview:'Предпросмотр',
    badgeSetWords:'Слов в наборе',
    badgeLearned:'Выучено',
    mistakesName: "Мои ошибки",   allMistakesDone: "Все ошибки закрыты!",
infoTitle: "Инструкция",
infoSteps: [
  "Выберите словарь и набор слов.",
  "Учите слова с помощью карточек, выбирая правильный перевод.",
  "Звёздочки показывают, насколько хорошо вы знаете слово.",
  "Когда набор выучен — автоматически откроется следующий.",
  "Ваш прогресс сохраняется."
],
    // 🎉 Мотивация
    praise: [
      "Отлично! 🎉",
      "Так держать! 💪",
      "Супер! 🚀",
      "Прекрасно! 🌟",
      "Молодец! 🏆"
    ],
    encouragement: [
      "Ошибки — тоже учёба 🧩",
      "Не сдавайся! 🔥",
      "Всё получится! ✨",
      "Ещё немного практики! ⏳",
      "Так формируется навык 🌀"
    ]
  ,
    pos_pronouns:'Местоимения'
  ,
    pos_numbers:'Числительные'
  ,
    pos_conjs:'Союзы'
  ,
    pos_particles:'Частицы',
    donateSoon: "Скоро: поддержка проекта"

  },
  uk: {
    appTitle:'Lexitron', tagline:'Він навчить!',
    modalTitle:'Словники', langLabel:'Мова',
    repeatLabel:'Складність', themeLabel:'Тема', ok:'OK',
    choose:'Оберіть переклад', iDontKnow:'Не знаю',
    totalWords:'Всього слів в словнику', learned:'Вивчено', errors:'Помилок',
    dictsHeader:'Словники',
    pos_verbs:'Дієслова', pos_nouns:'Іменники', pos_preps:'Прийменники',
    pos_adjs:'Прикметники', pos_advs:'Прислівники', pos_misc:'Словник',
    favTitle:'Обране', ttPreview:'Попередній перегляд',
    badgeSetWords:'Слів у наборі',
    badgeLearned:'Вивчено',
    mistakesName: "Мої помилки", allMistakesDone: "Усі помилки закриті!",
infoTitle: "Інструкція",
infoSteps: [
  "Оберіть словник і набір слів.",
  "Вчіть слова за допомогою карток, обираючи правильний переклад.",
  "Зірочки показують, наскільки добре ви знаєте слово.",
  "Коли набір вивчений — автоматично відкриється наступний.",
  "Ваш прогрес зберігається."
],
    // 🎉 Мотивация
    praise: [
      "Чудово! 🎉",
      "Так тримати! 💪",
      "Супер! 🚀",
      "Прекрасно! 🌟",
      "Молодець! 🏆"
    ],
    encouragement: [
      "Помилки — теж навчання 🧩",
      "Не здавайся! 🔥",
      "Усе вийде! ✨",
      "Ще трохи практики! ⏳",
      "Так формується навичка 🌀"
    ]
  ,
    pos_pronouns:'Займенники'
  ,
    pos_numbers:'Числівники'
  ,
    pos_conjs:'Сполучники'
  ,
    pos_particles:'Частки'
  }
};
// конец!


// injected language labels
;(function(){
  if (!window.App || !App.locales) return;
  if (App.locales.ru){ Object.assign(App.locales.ru, { allLangs: "Все языки", lang_sr: "Сербский" }); }
  if (App.locales.uk){ Object.assign(App.locales.uk, { allLangs: "Всі мови",   lang_sr: "Сербська" }); }
})();
