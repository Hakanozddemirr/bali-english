"""Aksen Kahraman oynatma listesini (yt-dlp --flat-playlist çıktısı) ders ünitelerine çevirir.
Kullanım: yt-dlp --flat-playlist --print "%(playlist_index)s|%(id)s|%(duration)s|%(title)s" <URL> > playlist.txt
          python3 scripts/buildCourse.py playlist.txt > src/content/course.json
"""
import json, re, sys

rows = []
for line in open(sys.argv[1], encoding='utf-8'):
    idx, vid, dur, title = line.rstrip('\n').split('|', 3)
    rows.append({'i': int(idx), 'id': vid, 'dur': int(float(dur or 0)), 'title': title})

SKIP = re.compile(r'(PDFs|Bootcamps and Channel|Grammar Hit|My Reading and Vocabulary|Kitab[ıi]m Yay[ıi]nda|Storybooks|1000 English Word Book)', re.I)
BOOK_READ = re.compile(r'Reading (Study|Exercise) \d', re.I)          # 50 Basic Reading Passages
BOOK_PUZ = re.compile(r'(Word Study with Puzzles|Bulmacalarla Kelime)', re.I)
VOCAB = re.compile(r'Vocabulary (Bootcamp|Camp) A1', re.I)
READ_EXTRA = re.compile(r'(English Reading Passages|Okuma Par[çc]alar[ıi]) \d', re.I)

def clean(t):
    t = re.sub(r'^\s*(LAST\s+)?(lesson|ders)\s*\d+\s*\|?\s*', '', t, flags=re.I)
    t = re.sub(r'\((Başlangıç|Beginner|Orta Seviye|Intermediate( Level)?|İleri Seviye|Advanced)\)', '', t, flags=re.I)
    t = re.sub(r'\b(Lecture|Topic Explanation|Konu Anlatımı)\b', '', t, flags=re.I)
    t = t.split('|')[0]
    return re.sub(r'\s+', ' ', t).strip(' -|')

lessons = {}   # key -> lesson
order = []
book = {'reading': [], 'puzzle': [], 'vocab': [], 'readingExtra': []}

def add(key, title, level, video):
    if key not in lessons:
        lessons[key] = {'key': key, 'title': title, 'level': level, 'videos': []}
        order.append(key)
    lessons[key]['videos'].append(video)

def level_of(t, n):
    if re.search(r'İleri', t): return 'İleri'
    if re.search(r'Orta|Intermediate', t): return 'Orta'
    if re.search(r'Başlangıç|Beginner', t): return 'Başlangıç'
    return 'Başlangıç' if n and n <= 32 else ('Orta' if n and n <= 116 else 'İleri')

for r in rows:
    t = r['title']
    v = {'id': r['id'], 'dur': r['dur']}
    if SKIP.search(t): continue
    if BOOK_READ.search(t): book['reading'].append({**v, 'title': t}); continue
    if BOOK_PUZ.search(t): book['puzzle'].append({**v, 'title': t}); continue
    if VOCAB.search(t): book['vocab'].append({**v, 'title': t}); continue
    if READ_EXTRA.search(t): book['readingExtra'].append({**v, 'title': t}); continue
    m = re.search(r'(?:lesson|ders)\s*(\d+)', t, re.I)
    if m:
        n = int(m.group(1))
        kind = 'alistirma' if re.search(r'exerc', t, re.I) else 'konu'
        if kind == 'konu' or str(n) not in lessons:
            title = clean(t)
        add(str(n), lessons.get(str(n), {}).get('title') or clean(t), level_of(t, n), {**v, 'kind': kind})
        continue
    if re.search(r'Irregular Verbs', t): add('irr', 'Düzensiz Fiiller (Irregular Verbs)', 'Başlangıç', {**v, 'kind': 'konu'}); continue
    m = re.search(r'Karma Çeviri Çalışması (\d)', t)
    if m: add('ceviri' + m.group(1), f'Karma Çeviri Çalışması {m.group(1)} (tekrar)', 'Orta', {**v, 'kind': 'tekrar'}); continue
    if re.search(r'BÜTÜN İNGİLİZCE ZAMANLAR', t): add('tenses45', 'Bütün Zamanlar — 45 dk tekrar', 'Orta', {**v, 'kind': 'tekrar'}); continue
    print('ATLANDI:', t, file=sys.stderr)

# Bazı derslerin anlatım videosu yok (örn. sadece alıştırma) — başlıklar konu videosundan gelsin
for k in order:
    L = lessons[k]
    konu = [x for x in L['videos'] if x['kind'] != 'alistirma']
    L['videos'].sort(key=lambda x: x['kind'] == 'alistirma')
    L['min'] = round(sum(x['dur'] for x in L['videos']) / 60)
    L['n'] = int(k) if k.isdigit() else None

# Günlük seanslar: video süresi ~28 dk'yı geçmeyecek şekilde ardışık dersleri birleştir
BUDGET = 28 * 60
sessions, cur, cur_s = [], [], 0
for k in order:
    s = sum(x['dur'] for x in lessons[k]['videos'])
    if cur and cur_s + s > BUDGET:
        sessions.append(cur); cur, cur_s = [], 0
    cur.append(k); cur_s += s
if cur: sessions.append(cur)

out = {
    'source': 'https://www.youtube.com/playlist?list=PLlLi1hQPF6u2MV_Hs7p0N--_XdiA6qu6U',
    'lessons': [lessons[k] for k in order],
    'sessions': sessions,
    'bookVideos': book,
}
json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
print(f'{len(order)} ünite, {len(sessions)} seans', file=sys.stderr)
