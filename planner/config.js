/* настройки ddx planner: цены, лимиты бесплатного тарифа, контакты и коды pro.
   этот файл публичный, поэтому коды хранятся только в виде хешей. */
window.DDX_CONFIG = {
  name: 'DDX Planner',

  // ии: адрес воркера из папки worker (ключ хранится только в нём). пока пусто, ии-функции скрыты
  ai: { url: 'https://ddx-ai.wsmp.workers.dev/' },

  // цены в тенге
  price: { month: 1090, year: 9990, life: 17990 },


  // куда писать после оплаты (telegram без @). проверь, что это твой ник
  support: { handle: 'ddwwks' },

  // лимиты бесплатного тарифа из плана
  limits: {
    notes: 30,        // текстовые заметки
    tasks: 15,         // активные задачи
    cats: 3,           // свои категории
    subs: 3,           // подзадач на одну задачу
    repeats: 2,        // активные повторяющиеся задачи
    reminders: 3,     // активные напоминания
    pins: 2,           // закреплённые заметки
    moneyMonth: 20,    // записей доходов и расходов в месяц
    archive: 30,      // записей в архиве
    voiceDay: 5,      // голосовых записей в день
    voiceCatDay: 5,   // голосовых выборов категории в день
    voiceSeconds: 60, // длина одной голосовой записи
    aiAskDay: 10,      // вопросов к ии в день
    aiFoodDay: 2,      // распознаваний еды по фото в день
    focusDay: 2,       // сессий focus mode в день
    lists: 2,          // умных списков
    habits: 2,         // привычек
    statsDays: 7,      // статистика за последние дни
    timelineDays: 7    // timeline за последние дни
  },

  // ии на pro: щедро, но не безгранично, чтобы расходы на модель были под контролем
  // версия приложения: мелкая правка 1.1.1, средняя 1.2, большое обновление 2.1 (так решил владелец)
  version: '1.1.2',
  proAi: { ask: 40, food: 15 },
  lifeAi: { ask: 1000, food: 300 },   // Founder Lifetime: на деле без лимитов, потолок только от случайных зацикливаний

  // что показывать в списке бесплатного тарифа
  freePlan: [
    'Голосовые записи: до 5 в день, до минуты',
    'ИИ: до 10 вопросов и 2 фото еды в день',
    'Текстовые заметки: до 30',
    'Категории: до 3 своих, голосовой выбор до 5 в день',
    'Задачи: до 15 активных, до 3 подзадач на задачу',
    'Напоминания: до 3 активных',
    'Повторяющиеся задачи: до 2 активных',
    'Быстрый ввод, приоритеты, Daily Reset, календарь, поиск, прогресс дня',
    'Focus Mode: до 2 раз в день',
    'Умные списки: до 2',
    'Трекер привычек: до 2',
    'Финансы: до 20 записей в месяц',
    'Статистика и Timeline: за последние 7 дней',
    'Закреплённые заметки: до 2',
    'Архив: до 30 записей'
  ],


  // sha-256 кода -> на сколько дней он даёт pro. создаются скриптом tools/make-code.js
  codes: {
    '57e0a2d85c1202b8214a441964feded9d77d6989bfff4242ce78ab2ac7cb2712': 31,
    'ebfe967d4597c60d219098668225a324fd77ed5f3b79d7dd45730b31bf91ac85': 31,
    '9ee5d7c10e41e38bf4f517b8483804d87d4d624d4868513c6f1621a4c3a78349': 31,
    'd415aa890c1643e046b1af6eefe6f0db70a0c4d79a7475337adf9a10217eeace': 366,
    'be48b176c1c1d48c37ece86525164ccd6fe8f2563dd2cc6f797e6154a45956fa': 366,
    '870ef2c9437df5773a0aa05f53528f93dd995ce287d277eaa561b998cb22d57a': 366,
    'e3649ab8a6d6856d7c43e1435359b5decd16ca45e291974a9eca0fd1cf3bb53e': 31,
    '55fd1fec110dff75574854e8c442a409a30c721f20824c5f3207c79678f72e9c': 31,
    '06fcdf4f9ffd57f29865b6cb2ef034fbc7f3116a671b0a02d92ff7e31855d39d': 31,
    'a6dd3b1b669521ed56e5879377d24e8b4b52cafe831e8bf3d1d7ed3581ef8988': 31,
    '262d15a3863ed410b0895e974f4ca8742e00922d80ee11428f915eb83b3c9cdc': 31,
    '6e1ad043339ff34473e850b82bb5f0a8fb769bd349e9774736a7f934b3850243': 31,
    '380dbb6a9b393fd4ee5ab32cbf1171c73960229c3d54d375eb2cb5b2d5fdf764': 31,
    'd9a6ea9fc78e49ecf09a245208f17ea9298bb0c892d917fae7e65f1b780a513a': 31,
    '9a2cbe90825ba713e271fe2db3a19490a566f45bc18e3c1866004b9f1cea0d34': 31,
    'bd98b2118502b60584aa54a3f1e1f26ed5437d1f3af788fc485ee8c242195d9a': 31,
    '0415bb4abbb970ec94b994b22eaa5a92942085d8eb321059e999d057398b083a': 31,
    '2ffaee9c958ee93c282e48071f7d06ee2c2e99d38d3f386473274a8b5b1dc2e0': 31,
    'f0e86fc6d092de91ec4ebb90f8ae73f3b948e4232583672b2d19e41c7b5a7882': 31,
    '7a3dbca6fb55f9566e71e63af10d8ee1dd4f3f3620ea2ba6acc69aab2a5a5dff': 31,
    'fd4f5b404ad1dd56688d88d32f4bae4201e3278a48809b845394ebc3cf36553d': 31,
    'bfd390353b71a7abc71d0e2f709aae545ae6a0a73599516781af42e89abd5aac': 31,
    '7a9d9a4be90c6fb54dc1e94dd975f4adecedf2856dc1c245dd905d28cc53ddaa': 31,
    'dc33544cccb5833d7c234e39d5ed763a49c0dda0b2824c9c7b00a075258b5170': 31,
    '13e2b61b9d00d22de27434d929f860465d7411e7aa3458a023a56292e7b529bc': 31,
    '08cd3e3058880a079090e2699ae765cc81b1e1c34f09f940a0ac251e298b28c8': 31,
    'c8d24bea141e35452a6fc8131fba76d272a04a430f693ab7be88a6a413ac31f5': 31,
    '6a277d6a6e3724d994bac743298b2e0867a8d9268e311236be3d59fe470184d4': 31,
    '22d08b5c46719e203587274d1075b0acd4cdac198e6e48533e8d2c37f63d1b97': 31,
    'f6bd1235eeeccd04ded279c239d11587f21847ff8ce5117fa943430f7f0e34f7': 31,
    '628c664b941c82c6f674aa89d7c1c256b4b1f289e50f20ee45bd8b4ecc2b0110': 31,
    '8a727bf2a86129d4d13e99c925552d4b89959e4195dadfc6c316f279c14e79e8': 31,
    '333465b12df12b3cf1782d037dcac0cda18bf274e558cea2fb1c3c83639dfc96': 31,
    'dd00e4f907e3babcea0e630f9f3d789da3da7da9902f2ad1df9b31c7e5ebb36b': 31,
    'a071440088d1047c508f7c5209e4e8e2a517bf9cd27be7019f6ad5f3fbde1f71': 31,
    '4ca115b2907e81703c74c61df59bd87a144cf4cb849cef98e947d7347a8eb24b': 31,
    '194c581805e95f35d44ee4fb1b752671eea9871b62e7c29175e44fc036cd40bf': 31,
    '24b9ae4efdcfd818e5184df8240e62da7a57c793c82abf6ca8d19ef1f07e7e23': 31,
    'a35b52afa9b5b310dbe638976567b7c8e3a246e220d7b5c0c1284ef05f2bd129': 31,
    'ef55ad566975533361846b42322201f8cb547cfa7a44e5b13ba5dd3b26a8150c': 31,
    '0def9afad12df1c4ca0eabec59bfd766c398ab812d00de641ac55715a07c6387': 31,
    '5b5ad3fbde9c11577f01716efec26555976aee7f9373785066639db4139ebf8e': 31,
    'ea7a448c31d79d93a0aa61067c870010b1cdb00c0564ad92651e73a2c9933d19': 31,
    '72d965a87c5760a240398d9caa87a7b4ad7b8641a8399307541ba5e33339397d': 31,
    '02d52f963fe05bb9070214814b2be4d741393bcbfdf38f9a636c68e3d4d69a8d': 31,
    '36b4db2d3a1ba13332e9f0733a91f0a5ec28cf2b18fb825f48bc1455c2f33027': 31,
    '846e09b37c6e73bd3c56e7e11a140ac0cc16b55e9d3ccffe3bc25f9d97fd337f': 31,
    '3e8f039811079ca422c524f68269d20c5d65edd485b91e0f48fe06ca8c8abdff': 31,
    'f59677d384800df76dd3aae1513c4f6223218c19ca65929d4ff7c89217c835da': 31,
    '935bd10b10e38435aa6bc056bf3dd684c4aa5f7f0e0542a65c281a1387ae2349': 31,
    'e136b13d209e6c35b4d5fb7f5c0a33eb8a31258d1a203ffa4f4fc0d0637a6e39': 31,
    '319cf65840853eff93280e1233f4d3ce5f68bf545f76b09966754578b5a5ef4e': 31,
    '8f59944cef894f8bafb2840b34d5dbf2b03fbc454e1d6f62b0d803c8d02849f1': 31,
    '783d0c802725a646b6d88d90b2ee2746d76d13c5e01abd8e7624218a3fef6e7a': 31,
    '5cd29de500224d6f046ef13d6aa3151a188068f6776fa8886d1358cef0166e88': 31,
    'bc08a0b40db215e7dd3622beef8d644afd169b5b7d0c5c61cfe5d05edf695df3': 31,
    '57b563fe71d9aa33e0d87e37533ab517b72bd0378169fa5b1a4a8b966fd3160b': 366,
    '8557869a20386cf20793bf0035e042367e7689710af57671c0338e7a117596d8': 366,
    'abcc53f0046c746a1669e215a757eb6146bceece854d3eb1917a67f30aeea8ef': 366,
    'fb565da3df3647e0dd3eb7f5f4b31df1c81e52d7d46410c9bcfeb11463fcbe69': 366,
    '074e4654e31ed4a671854f4a2c187b33713ff7e103186b12485b48f10a778a35': 366,
    'e3b01b42228b6f547b3b5657ef6a97ac3290f933b9cf385c301687f92b99dc16': 366,
    'a4bd36543dbd644630f5a9e2ca4b6397343d16822baad8ec2179489166f43424': 366,
    'fbd859cf4a3574e8b424408a4d96f6abaf0e38b32b8e878a742f7734f6d23255': 366,
    'f7595e1039538aff676adcd54ef138304703ce0d9cc11ff3965a9a250e23308a': 366,
    'c7c19b231cbcc744e9f7b29c2af57795a04de887b368b67c9f1acf332f49f4b0': 366,
    '322629ddb6c4ef34d18748dd4ade269522ae787d62f5cde2c5901679f64c7597': 366,
    'b74cf6b8d9b231c12f906558726aeee9b5602191ac4b5a09f7e7315e1e776f7d': 366,
    '1c00a4fe62fb76bc65025e5c3aa89024ff53cd75ba4e23e6ceb5508b86c2cd10': 366,
    'b8b75c8ad779fc51e236c414295152f27bce9f464b6eba4eef7d25681ec320a7': 366,
    '61c9350edbc988a2266e765f80e88589508ff31502432d34bf42e07d8a65851c': 366,
    'e2d4018b1b1200ee412290f2c2daf516626b57ba5a20d876a15cf138320b9b11': 366,
    '19ccf615ba1659560efedc2f1bd71dfaf65035c5ef88a95d8ea8f2f3d0ea3187': 366,
    'c045b34e900fbd0b536d8f31e2f7bd5f092d39584f54f00ddd347e206fc3907b': 366,
    '201ef9aa75809aa222c55019f4ecf17d50c0d3a3fd2b440617ae05e9306766e6': 366,
    'cae053c064bdb4917b84895b0060b5971b4e2bae05b851d595fd34cf97ea0849': 366,
    '084992b99d11b16e8c4c86259d35b6573555f5010e55384177029a45a3d63d53': 36500,
    '4a814e3c22554b9e3c24162725e7af59b9e59ccb72b33c67cadc8f5d306602de': 36500,
    '4de2b9b084a8e00950fb9d0e3c3a1adb1d638237728ce3ef458c5cda21fe1385': 36500,
    '2f9b864ef5e1fd3ad0a8ceaf680d98a864ce191743a3335bfd4d4ae4878856ac': 36500,
    '35cfa31b4343bc48a1121d1aafa7b464064cc85fffd29654d2963a16d040537a': 36500
  }
};
