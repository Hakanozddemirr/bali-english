# Sentence Lab content brief

Learner: a Turkish adult entrepreneur (runs an online clothing shop, goes to the gym, drinks coffee, just spent a month in Bali (Canggu), will return in ~4 months). Level ~A1+: understands a lot when listening but cannot build sentences when speaking. Known errors: forgets past tense ("I like the club" for "I liked"), doesn't use "want to", puts "the" before place names ("the Canggu"), gives very short answers.

He watches a Turkish-explained YouTube grammar lesson (teacher Aksen Kahraman), then does a "Sentence Lab": he sees a Turkish sentence and must SAY it in English. Lesson titles/order: `src/content/course.json` (`lessons[].key`, `title`). Lesson order = list order.

Output: ONE JSON file, an object keyed by lesson key (string), each value:
{
  "focusTr": "1-2 short Turkish sentences: the single most useful rule of this lesson for SPEAKING (not a grammar lecture).",
  "pattern": "compact formula, e.g. \"I am / You are / He is + sıfat\"",
  "items": [ 12 items: {"tr": "natural Turkish sentence", "en": ["main natural English answer", "other acceptable variants..."], "tip": "optional ≤12-word Turkish hint, only for a classic Turkish-speaker trap"} ],
  "talk": ["3 short English questions a conversation partner could ask that make him USE this structure"]
}

Item rules:
- Items 1-4: very short (3-5 words), shown as word tiles to arrange → en[0] must be a clean sentence without commas.
- Items 5-8: 5-8 words. Items 9-12: longer, with "and/because/but" or a second clause, still A1-A2 words.
- Keep the lesson structure in EVERY item. Prefer grammar seen up to this lesson; simple chunks like "I live in", "I want to" are fine anywhere.
- Topics from his real life: online shop, customers, coffee, gym, phone, family, friends, Istanbul, Bali/Canggu, scooter, beach, cafe, villa, travel. Vary. No childish textbook content.
- "en": every natural variant a grader should accept (contractions and full forms, a/the where both fine). Include final punctuation. Max 6 variants.
- Turkish: natural everyday Turkish, mapping unambiguously to the English.
- Numbers/dates/times: spell numbers as words in en (e.g. "It's half past seven." and "It's seven thirty.").
- Pure "review" units (keys like ceviri1, tenses45) are not your concern.
- Valid JSON only. Validate with `python3 -m json.tool <file>` before finishing.

Reply when done with: file path, number of lessons, and one line per notable judgment call.
