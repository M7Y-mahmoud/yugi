// Centralized Card Translator & Localizer for Yu-Gi-Oh! Cards

const CARD_TRANSLATIONS = {
  "dark magician": {
    nameAr: "الساحر المظلم",
    descAr: "الساحر النهائي من حيث الهجوم والدفاع."
  },
  "blue-eyes white dragon": {
    nameAr: "التنين الأبيض أزرق العينين",
    descAr: "هذا التنين الأسطوري هو محرك دمار قوي. لا يرحم أي خصم يقف في طريقه."
  },
  "red-eyes black dragon": {
    nameAr: "التنين الأسود أحمر العينين",
    descAr: "تنين شرس يمتلك هجوماً نارياً مدمراً يحرق كل ما حوله."
  },
  "monster reborn": {
    nameAr: "إحياء الوحش",
    descAr: "استهدف وحشاً في مقبرة أي لاعب؛ استدعه خاصاً إلى ساحتك."
  },
  "mirror force": {
    nameAr: "القوة العاكسة",
    descAr: "عندما يُعلن وحش الخصم هجوماً: دمر جميع الوحوش في وضع الهجوم التي يسيطر عليها الخصم."
  },
  "dark hole": {
    nameAr: "الثقب الأسود",
    descAr: "دمر جميع الوحوش الموجودة على الساحة."
  },
  "raigeki": {
    nameAr: "رايجيكي (الصاعقة)",
    descAr: "دمر جميع الوحوش التي يسيطر عليها الخصم."
  },
  "polymerization": {
    nameAr: "الاندماج (بوليمرايزيشن)",
    descAr: "أرسل وحوش الاندماج المذكورة في ورقة وحش الاندماج من يدك أو ساحتك إلى المقبرة، ثم استدعِ ذلك الوحش خاصاً من مجموعتك الإضافية."
  },
  "mystical space typhoon": {
    nameAr: "إعصار الفضاء الخارق",
    descAr: "استهدف ورقة سحر/فخ واحدة على الساحة؛ دمر تلك الورقة."
  },
  "pot of greed": {
    nameAr: "وعاء الطمع",
    descAr: "اسحب كارتين من مجموعتك."
  },
  "swords of revealing light": {
    nameAr: "سيوف النور الكاشفة",
    descAr: "اكشف جميع وحوش الخصم المقلوبة. تبقى هذه الورقة على الساحة لـ 3 أدوار. طالما هذه الورقة على الساحة، لا يمكن لوحوش الخصم إعلان هجوم."
  },
  "change of heart": {
    nameAr: "تغيير القلب",
    descAr: "استهدف وحشاً يسيطر عليه الخصم؛ خذ السيطرة عليه حتى نهاية الدور."
  },
  "exodia the forbidden one": {
    nameAr: "إكسوديا المحظور",
    descAr: "إذا كان لديك 'ذراع الأيمن للمحظور'، 'ذراع الأيسر للمحظور'، 'ساق الأيمن للمحظور'، 'ساق الأيسر للمحظور' بالإضافة لهذه الورقة في يدك، تفوز بالمبارزة فوراً."
  },
  "right arm of the forbidden one": {
    nameAr: "الذراع الأيمن للمحظور",
    descAr: "ذراع أيمن مقيد بسحر محظور. من يجمع جميع الأجزاء يحصل على قوة لا تقهر."
  },
  "left arm of the forbidden one": {
    nameAr: "الذراع الأيسر للمحظور",
    descAr: "ذراع أيسر مقيد بسحر محظور. من يجمع جميع الأجزاء يحصل على قوة لا تقهر."
  },
  "right leg of the forbidden one": {
    nameAr: "الساق اليمنى للمحظور",
    descAr: "ساق يمنى مقيدة بسحر محظور."
  },
  "left leg of the forbidden one": {
    nameAr: "الساق اليسرى للمحظور",
    descAr: "ساق يسرى مقيدة بسحر محظور."
  },
  "slifer the sky dragon": {
    nameAr: "سلايفر تنين السماء",
    descAr: "يتطلب 3 تضحيات للاستدعاء العادي. يكسب هذا الكارت 1000 هجوم ودفاع مقابل كل كارت في يدك. عندما يستدعي الخصم وحشاً: ينقص هجومه بمقدار 2000، وإذا وصل هجومه إلى 0 يُدمر."
  },
  "obelisk the tormentor": {
    nameAr: "أوبليسك المعذب",
    descAr: "يتطلب 3 تضحيات للاستدعاء العادي. لا يمكن استهداف هذه الورقة بتأثيرات الكروت. يمكنك التضحية بوحشين لتدمير جميع وحوش الخصم."
  },
  "the winged dragon of ra": {
    nameAr: "راع التنين المجنح",
    descAr: "يتطلب 3 تضحيات للاستدعاء العادي. يمكنك دفع جميع نقاط حياتك باستثناء 100 LP ليكسب هذا الكارت هجوم ودفاع يساوي النقاط المدفوعة."
  },
  "kuriboh": {
    nameAr: "كوريبو",
    descAr: "خلال حساب الضرر، يمكنك إرمي هذه الورقة من يدك إلى المقبرة لتبطل الضرر الواقع على نقاط حياتك في تلك المعركة."
  },
  "cyber dragon": {
    nameAr: "التنين السيبراني",
    descAr: "إذا كان الخصم يسيطر على وحش وأنت لا تسيطر على أي وحوش، يمكنك استدعاء هذه الورقة خاصاً من يدك."
  },
  "blue-eyes ultimate dragon": {
    nameAr: "التنين الأبيض أزرق العينين النهائي",
    descAr: "اندماج بين 3 وحوش 'التنين الأبيض أزرق العينين'. قوة هجومية فائقة تجتاح أي خصم."
  },
  "trap hole": {
    nameAr: "حفرة الفخ",
    descAr: "عندما يستدعي الخصم وحشاً بنقاط هجوم 1000 أو أكثر: استهدف ذلك الوحش؛ دمره."
  },
  "harpie's feather duster": {
    nameAr: "ممسحة ريش الهاربي",
    descAr: "دمر جميع أوراق السحر والفخ التي يسيطر عليها الخصم."
  },
  "solemn judgment": {
    nameAr: "الحكم الصارم",
    descAr: "ادفع نصف نقاط حياتك: ألغِ استدعاء وحش أو تفعيل ورقة سحر/فخ ودمر تلك الورقة."
  }
};

const TYPES_AR = {
  "normal monster": "وحش عادي",
  "effect monster": "وحش تأثير",
  "ritual monster": "وحش طقوسي",
  "ritual effect monster": "وحش طقوسي (تأثير)",
  "fusion monster": "وحش اندماج",
  "synchro monster": "وحش سينكرو",
  "xyz monster": "وحش إكسيز",
  "pendulum effect monster": "وحش بنادول (تأثير)",
  "pendulum normal monster": "وحش بنادول (عادي)",
  "link monster": "وحش رابط",
  "spell card": "ورقة سحر",
  "trap card": "ورقة فخ",
  "skill card": "ورقة مهارة",
  "token": "رمز (Token)",
  "monster": "وحش",
  "spell": "ورقة سحر",
  "trap": "ورقة فخ"
};

const ATTRIBUTES_AR = {
  "dark": "ظلام 🌑",
  "light": "ضوء ☀️",
  "earth": "أرض ⛰️",
  "water": "ماء 💧",
  "fire": "نار 🔥",
  "wind": "رياح 🌪️",
  "divine": "إلهي ✨"
};

const RACES_AR = {
  "spellcaster": "ساحر",
  "dragon": "تنين",
  "zombie": "زومبي",
  "warrior": "محارب",
  "beast-warrior": "محارب وحشي",
  "beast": "وحش مفترس",
  "winged beast": "وحش مجنح",
  "fiend": "شيطان",
  "fairy": "ملاك",
  "insect": "حشرة",
  "dinosaur": "ديناصور",
  "reptile": "زاحف",
  "fish": "سمكة",
  "sea serpent": "ثعبان بحر",
  "aqua": "مائي",
  "pyro": "ناري",
  "thunder": "رعدي",
  "rock": "صخري",
  "plant": "نبات",
  "machine": "آلة",
  "psychic": "سايكك (نفسي)",
  "divine-beast": "وحش إلهي",
  "cyberse": "سايبرس",
  "wyrm": "تنين ويرم",
  "normal": "عادي",
  "continuous": "مستمر",
  "equip": "تجهيز",
  "quick-play": "لعب سريع",
  "field": "حقل",
  "counter": "مضاد",
  "ritual": "طقوس"
};

function isArabicText(str) {
  return /[\u0600-\u06FF]/.test(str || '');
}

function translateEnglishText(text) {
  if (!text) return "لا يوجد وصف متاح لهذه البطاقة.";
  let str = text;

  const replacements = [
    [/Special Summon/gi, "استدعاء خاص"],
    [/Normal Summon/gi, "استدعاء عادي"],
    [/Tribute Summon/gi, "استدعاء بتضحية"],
    [/Tribute/gi, "تضحية"],
    [/Graveyard/gi, "المقبرة"],
    [/Deck/gi, "المجموعة"],
    [/Hand/gi, "اليد"],
    [/Battle Phase/gi, "مرحلة المعركة"],
    [/Main Phase/gi, "المرحلة الرئيسية"],
    [/Standby Phase/gi, "مرحلة الاستعداد"],
    [/End Phase/gi, "مرحلة النهاية"],
    [/Direct Attack/gi, "هجوم مباشر"],
    [/Life Points/gi, "نقاط الحياة"],
    [/LP/gi, "نقاط الحياة"],
    [/Destroyed/gi, "تم تدميره"],
    [/Destroy/gi, "تدمير"],
    [/Target/gi, "استهداف"],
    [/Negate/gi, "إلغاء"],
    [/Banished/gi, "مستبعد من اللعبة"],
    [/Banish/gi, "استبعاد"],
    [/Face-up/gi, "مكشوف (وجهه للأعلى)"],
    [/Face-down/gi, "مقلوب (وجهه لأسفل)"],
    [/Attack Position/gi, "وضع الهجوم"],
    [/Defense Position/gi, "وضع الدفاع"],
    [/Spell\/Trap/gi, "سحر/فخ"],
    [/Spell Card/gi, "ورقة سحر"],
    [/Trap Card/gi, "ورقة فخ"],
    [/Monster/gi, "وحش"]
  ];

  replacements.forEach(([pattern, val]) => {
    str = str.replace(pattern, val);
  });

  return str;
}

export function getCardDetailsAr(card) {
  if (!card) return {
    nameAr: 'بطاقة غير معروفة',
    nameEn: '',
    typeAr: 'غير معروف',
    attributeAr: null,
    raceAr: null,
    level: null,
    atk: null,
    def: null,
    descAr: 'لا توجد بيانات لهذه البطاقة.'
  };

  const nameKey = (card.name || '').toLowerCase().trim();
  const known = CARD_TRANSLATIONS[nameKey] || {};

  const nameAr = card.nameAr || known.nameAr || card.name || 'بطاقة بدون اسم';
  const nameEn = card.name || '';

  const rawType = (card.type || '').toLowerCase().trim();
  const typeAr = TYPES_AR[rawType] || (rawType.includes('monster') ? 'وحش' : (rawType.includes('spell') ? 'ورقة سحر' : (rawType.includes('trap') ? 'ورقة فخ' : (card.type || 'غير معروف'))));

  const rawAttr = (card.attribute || '').toLowerCase().trim();
  const attributeAr = ATTRIBUTES_AR[rawAttr] || card.attribute || null;

  const rawRace = (card.race || '').toLowerCase().trim();
  const raceAr = RACES_AR[rawRace] || card.race || null;

  let descAr = card.descAr || card.descriptionAr || known.descAr;
  if (!descAr) {
    const origDesc = card.description || card.desc || '';
    if (origDesc && isArabicText(origDesc)) {
      descAr = origDesc;
    } else if (origDesc) {
      descAr = translateEnglishText(origDesc);
    } else {
      descAr = 'لا يوجد وصف متاح لهذه البطاقة.';
    }
  }

  return {
    nameAr,
    nameEn,
    typeAr,
    attributeAr,
    raceAr,
    level: card.level || card.rank,
    atk: card.atk,
    def: card.def,
    descAr
  };
}
