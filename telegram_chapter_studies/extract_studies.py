#!/usr/bin/env python3
"""
extract_studies.py - pull chapter-by-chapter Bible studies out of Telegram Desktop JSON exports.

Usage (Windows):
    python extract_studies.py result.json result_1.json --out studies_out --channel HouseOfWews2

  first file  = main channel export (Jag's House of Wews 2)
  second file = optional archive channel export (Jag's House of Bible Studies); used only as a
                hint that a post belongs to a study
Outputs in --out:
  chapter_studies.json   book -> chapter -> list of studies (primary first), each with its posts
  by_book/NN Book.md     readable review copy, one file per book
  coverage.csv           every chapter of the Bible with status (series / one-off only / MISSING)
  kjv_reference.json     KJV text downloaded once, used only to recognise chapter posts
No third-party packages needed.
"""
import json,re,os,sys,csv,datetime,argparse,urllib.request
from collections import defaultdict,Counter
ap=argparse.ArgumentParser()
ap.add_argument('main'); ap.add_argument('archive',nargs='?')
ap.add_argument('--out',default='studies_out'); ap.add_argument('--channel',default='HouseOfWews2')
A_=ap.parse_args()
MAIN_JSON,ARCHIVE_JSON,OUTDIR,CHANNEL=A_.main,A_.archive,A_.out,A_.channel
os.makedirs(OUTDIR,exist_ok=True)

# ---------- book tables ----------
BOOKS="Genesis Exodus Leviticus Numbers Deuteronomy Joshua Judges Ruth 1_Samuel 2_Samuel 1_Kings 2_Kings 1_Chronicles 2_Chronicles Ezra Nehemiah Esther Job Psalms Proverbs Ecclesiastes Song_of_Solomon Isaiah Jeremiah Lamentations Ezekiel Daniel Hosea Joel Amos Obadiah Jonah Micah Nahum Habakkuk Zephaniah Haggai Zechariah Malachi Matthew Mark Luke John Acts Romans 1_Corinthians 2_Corinthians Galatians Ephesians Philippians Colossians 1_Thessalonians 2_Thessalonians 1_Timothy 2_Timothy Titus Philemon Hebrews James 1_Peter 2_Peter 1_John 2_John 3_John Jude Revelation".split()
BOOKS=[b.replace('_',' ') for b in BOOKS]
def txt(x):
    t=x.get('text','')
    if isinstance(t,list): return ''.join(p if isinstance(p,str) else p.get('text','') for p in t)
    return t
alias={b.lower():b for b in BOOKS}
alias.update({'psalm':'Psalms','song of songs':'Song of Solomon','revelations':'Revelation','i samuel':'1 Samuel'})
pat=re.compile(r'^\s*(?:the\s+)?([1-3]?\s*[A-Za-z][A-Za-z ]+?)\s+(?:chapter\s+)?(\d{1,3})\s*$',re.I)
def header(t):
    lines=[l for l in t.split('\n') if l.strip()]
    if len(lines)<2: return None
    mm=pat.match(lines[0].replace('*','').strip())
    if not mm: return None
    b=re.sub(r'\s+',' ',mm.group(1).strip().lower())
    if b not in alias: return None
    return alias[b],int(mm.group(2))
CH=[50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22]
NCH=dict(zip(BOOKS,CH))


# ---------- KJV matcher ----------
KJV_URL='https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json'
def _kjv():
    p=os.path.join(OUTDIR,'kjv_reference.json')
    if not os.path.exists(p):
        print('Downloading KJV reference text for matching...')
        urllib.request.urlretrieve(KJV_URL,p)
    return json.loads(open(p,encoding='utf-8-sig').read())
K=_kjv()
def norm(s):
    s=s.lower().replace('’',"'")
    s=re.sub(r"\{[^}]*\}","",s)  # strip footnote braces if any
    return re.findall(r"[a-z]+",s)
SH=6
IDX=defaultdict(set)
VERSES={}
for bi,b in enumerate(K):
    bn=BOOKS[bi]
    for ci,ch in enumerate(b['chapters']):
        for vi,v in enumerate(ch):
            w=norm(v); VERSES[(bn,ci+1,vi+1)]=w
            for i in range(max(1,len(w)-SH+1)):
                IDX[' '.join(w[i:i+SH])].add((bn,ci+1,vi+1))
def scripture(text,prefer=None):
    w=norm(text)
    if len(w)<SH: return None
    pos=defaultdict(set); vs=defaultdict(set); cov=[0]*len(w)
    for i in range(len(w)-SH+1):
        refs=IDX.get(' '.join(w[i:i+SH]))
        if refs:
            for j in range(i,i+SH): cov[j]=1
            for r in refs:
                vs[(r[0],r[1])].add(r[2])
                for j in range(i,i+SH): pos[(r[0],r[1])].add(j)
    if not vs: return None
    best=max(vs,key=lambda k:(len(pos[k]),len(vs[k])))
    for p in (prefer or []):
        if p in pos and len(pos[p])>=0.6*len(pos[best]): best=p; break
    return best[0],best[1],vs[best],len(pos[best])/len(w)

# ---------- thread assembly ----------

main=json.load(open(MAIN_JSON,encoding='utf-8'))['messages']
arch=json.load(open(ARCHIVE_JSON,encoding='utf-8'))['messages'] if ARCHIVE_JSON else []
ALLIDS={x['id'] for x in main}
M=[x for x in main if x['type']=='message' and not x.get('forwarded_from')]
BYID={x['id']:x for x in M}
def key(t): return ' '.join(norm(t)[:25])
ARCH=set(key(txt(x)) for x in arch if x['type']=='message' and len(txt(x))>40)
NCHV={}
for bi,bk in enumerate(K):
    for ci,ch in enumerate(bk['chapters']): NCHV[(BOOKS[bi],ci+1)]=len(ch)

def md(x):
    t=x.get('text','')
    if isinstance(t,str): return t
    out=[]
    for p in t:
        if isinstance(p,str): out.append(p); continue
        s=p.get('text',''); ty=p.get('type')
        if not s.strip(): out.append(s); continue
        if ty=='text_link':
            out.append(f'[{s.strip()}]({p.get("href")})'); continue
        mk={'bold':'**','italic':'*'}.get(ty)
        if not mk: out.append(s); continue
        segs=[]
        for line in s.split('\n'):
            if line.strip():
                lead=line[:len(line)-len(line.lstrip())]; trail=line[len(line.rstrip()):]
                segs.append(lead+mk+line.strip()+mk+trail)
            else: segs.append(line)
        out.append('\n'.join(segs))
    return ''.join(out)

refpat=re.compile(r'^\W*((?:[1-3]|i{1,3})?\s*[A-Za-z][A-Za-z ]*?)\.?\s*(?:chapter\s*)?(\d{1,3})?(?:\s*[:\.]\s*[\d\-–—, ]+)?\s*(?:kjv)?\s*$',re.I)
def firstline_ref(t):
    lines=[l for l in t.split('\n') if l.strip()]
    if not lines: return None
    m=refpat.match(lines[0].replace('*','').replace('\xa0',' ').strip())
    if not m: return None
    b=re.sub(r'\s+',' ',m.group(1).strip().lower())
    b=re.sub(r'^iii ','3 ',b); b=re.sub(r'^ii ','2 ',b); b=re.sub(r'^i ','1 ',b)
    if b not in alias: return None
    return alias[b], int(m.group(2)) if m.group(2) else None

def day(x): return datetime.datetime.fromisoformat(x['date'])
mentpat=lambda b,c: re.compile(r'\b'+re.escape(b if b!='Psalms' else 'Psalm')+r's?\s+(?:chapter\s+)?'+str(c)+r'\b',re.I)

studies=[]; assign={}; info={}
active=None; pending=[]

def series_next(st,when):
    if st[1]==1: return True
    for q in reversed(studies[-40:]):
        if q['book']==st[0] and 1<=st[1]-q['ch']<=3 and (when-q['last']).days<=14: return True
    return False

def startof(x,ref,sc):
    if not sc: return None
    b,c,vs,cov=sc
    fl=[l for l in txt(x).split('\n') if l.strip()][0]
    if ':' in fl and min(vs)>1: return None
    if cov<0.6 or len(vs)<min(3,NCHV[(b,c)]): return None
    if min(vs)<=2 or (min(vs)<=5 and ref and ref[0]==b and ref[1]==c): return (b,c)
    return None

for x in M:
    i=x['id']; t=txt(x); ref=firstline_ref(t)
    prefer=[]
    if active is not None:
        A=studies[active]
        if A['ch']<NCH[A['book']]: prefer.append((A['book'],A['ch']+1))
    if ref: prefer.append((ref[0],ref[1] or 1))
    sc=scripture(t,prefer) if len(t)>60 else None
    if sc and not ref: sc=None if sc[3]<0.6 or not re.match(r'^\s*\d',t) else sc  # unlabeled scripture only as numbered continuation
    info[i]=(ref,sc)
    st=startof(x,ref,sc) if ref else None
    rt=x.get('reply_to_message_id')
    parent=assign.get(rt)
    orphan = rt is not None and (rt not in ALLIDS)   # parent deleted/forwarded/missing
    if active is not None and not st and sc and (sc[0],sc[1])==(studies[active]['book'],studies[active]['ch']) and sc[3]>=0.6 and (day(x)-studies[active]['last']).total_seconds()<=600:
        A=studies[active]; assign[i]=active; A['posts'].append(i); A['last']=day(x); continue
    if parent is not None:
        P=studies[parent]
        if not (st and ((st[0]==P['book'] and st[1]!=P['ch'] and abs(st[1]-P['ch'])<=3) or series_next(st,day(x)))):
            assign[i]=parent; P['posts'].append(i); P['last']=max(P['last'],day(x)); continue
    elif rt is not None and not orphan and not st:
        continue   # reply to an unrelated thread
    if st and active is not None and not rt:
        A=studies[active]
        if st[0]!=A['book'] and (day(x)-A['last']).total_seconds()<=1200 and not series_next(st,day(x)):
            assign[i]=active; A['posts'].append(i); A['last']=day(x); continue
    if st:
        if active is not None and (studies[active]['book'],studies[active]['ch'])==st and (day(x)-studies[active]['last']).days<=7:
            s=active
        else:
            studies.append(dict(book=st[0],ch=st[1],start_id=i,date=x['date'],last=day(x),posts=[])); s=len(studies)-1
            for p in pending:
                if p['ch']==st and (day(x)-day(BYID[p['id']])).days<=3 and p['id'] not in assign:
                    assign[p['id']]=s; studies[s]['posts'].append(p['id'])
        active=s; assign[i]=s; studies[s]['posts'].append(i); studies[s]['last']=day(x); continue
    if active is None: continue
    A=studies[active]; ab,ac=A['book'],A['ch']
    gap=(day(x)-A['last']).total_seconds()/3600
    if orphan and gap<=3:
        assign[i]=active; A['posts'].append(i); A['last']=day(x); continue
    if sc and sc[0]==ab and sc[1]==ac and sc[3]>=0.6 and gap<=72:
        assign[i]=active; A['posts'].append(i); A['last']=day(x); continue
    if not rt and len(t)>=300 and gap<=0.75 and not (sc and sc[3]>=0.6 and (sc[0],sc[1])!=(ab,ac) and False):
        assign[i]=active; A['posts'].append(i); A['last']=day(x); continue
    if len(t)>=250:
        head=t[:250]
        if (mentpat(ab,ac).search(head) or re.search(r'\bchapter\s+'+str(ac)+r'\b',head,re.I)) and gap<=36:
            assign[i]=active; A['posts'].append(i); A['last']=day(x); continue
        if ac<NCH[ab] and mentpat(ab,ac+1).search(head):
            pending.append(dict(id=i,ch=(ab,ac+1))); continue
        if key(t) in ARCH and gap<=24 and not (sc and (sc[0],sc[1])!=(ab,ac)):
            assign[i]=active; A['posts'].append(i); A['last']=day(x); continue

for s in studies: s['posts'].sort()

# ---------- series detection ----------
S=[{k:v for k,v in s.items() if k!='last'} for s in studies]
D=lambda s: datetime.datetime.fromisoformat(s['date'])
byb=defaultdict(list)
for i,s in enumerate(S): s['idx']=i; byb[s['book']].append(s)
for b,L in byb.items():
    L.sort(key=D)
    runs=[]
    for s in L:
        placed=False
        for r in runs:
            last=r[-1]
            if -3<= s['ch']-last['ch'] <=4 and s['ch'] not in [q['ch'] for q in r] and (D(s)-D(last)).days<=40:
                r.append(s); placed=True; break
        if not placed: runs.append([s])
    for r in runs:
        span=r[-1]['ch']-r[0]['ch']+1
        ser = len(r)>=3 or (NCH[b]<=3 and len(r)==NCH[b]) or (NCH[b]==1)
        for s in r: s['series']=bool(ser); s['run']=f"{r[0]['date'][:10]}"

# ---------- output ----------

def link(i): return f'https://t.me/{CHANNEL}/{i}'
out={b:{} for b in BOOKS}
for s in S:
    posts=[]
    for p in s['posts']:
        x=BYID[p]; t=md(x).strip()
        media=x.get('media_type') or ('photo' if x.get('photo') else None)
        if not t and not media: continue
        r,sc=info[p]
        kind='scripture' if (sc and sc[0]==s['book'] and sc[1]==s['ch'] and sc[3]>=0.6) else 'study'
        posts.append(dict(id=p,date=x['date'],kind=kind,text=t,**({'media':media} if media else {})))
    if not posts: continue
    study_chars=sum(len(p['text']) for p in posts if p['kind']=='study')
    out[s['book']].setdefault(str(s['ch']),[]).append(dict(
        date=s['date'][:10],series=s['series'],link=link(s['start_id']),
        study_chars=study_chars,posts=posts))
# link scripture-only studies to a same-sitting neighbor that carries the commentary
for s in S: s['_dt']=datetime.datetime.fromisoformat(s['date'])

for b in out:
    for c,L in out[b].items():
        for v in L:
            if v['study_chars']==0:
                d=datetime.datetime.fromisoformat(v['posts'][0]['date'])
                for dc in (1,-1,2,-2):
                    for w in out[b].get(str(int(c)+dc),[]):
                        if w['study_chars']>0 and abs((datetime.datetime.fromisoformat(w['posts'][0]['date'])-d).total_seconds())<=6*3600:
                            v['commentary_with']=f'{b} {int(c)+dc}'; break
                    if 'commentary_with' in v: break
        L.sort(key=lambda v:(not v['series'], v['study_chars']==0, -v['study_chars']))
        for k,v in enumerate(L): v['primary']=(k==0 and v['series'])
    out[b]=dict(sorted(out[b].items(),key=lambda kv:int(kv[0])))
os.makedirs(os.path.join(OUTDIR,'by_book'),exist_ok=True)
json.dump(out,open(os.path.join(OUTDIR,'chapter_studies.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)

# markdown per book
rows=[]
for bi,b in enumerate(BOOKS):
    L=[f'# {b}\n']
    for c in range(1,NCH[b]+1):
        V=out[b].get(str(c),[])
        prim=[v for v in V if v['primary']]
        status=('series (commentary under '+prim[0]['commentary_with']+')' if prim and prim[0].get('commentary_with') else 'series (scripture only)' if prim and prim[0]['study_chars']==0 else 'series') if prim else ('one-off only' if V else 'MISSING')
        sc=prim[0] if prim else None
        rows.append([b,c,status, sc['date'] if sc else '', sc['link'] if sc else '', sc['study_chars'] if sc else 0, len(V)-(1 if prim else 0)])
        if not V: L.append(f'\n## {b} {c}\n\n_No study found in the export._\n'); continue
        for v in V:
            tag='Primary study' if v['primary'] else ('Series study (other pass)' if v['series'] else 'Other post on this chapter')
            L.append(f"\n## {b} {c}  ·  {tag}  ·  {v['date']}\n\nSource: {v['link']}\n"+(f"\n_Commentary for this chapter was posted with {v['commentary_with']}._\n" if v.get('commentary_with') else ''))
            for p in v['posts']:
                hdr=f"\n<!-- post {p['id']} · {p['date'][:16].replace('T',' ')} · {p['kind']}{' · has '+p['media'] if p.get('media') else ''} -->\n"
                L.append(hdr+'\n'+p['text']+'\n')
    open(os.path.join(OUTDIR,'by_book',f'{bi+1:02d} {b}.md'),'w',encoding='utf-8').write(''.join(L))
inside=defaultdict(list)
for s_ in S:
    for p in s_['posts']:
        r,sc=info[p]
        if sc and sc[3]>=0.6 and len(sc[2])>=3 and (sc[0],sc[1])!=(s_['book'],s_['ch']):
            inside[(sc[0],sc[1])].append(f"{s_['book']} {s_['ch']} ({s_['date'][:10]}, {link(p)})")
for r in rows:
    r.append('; '.join(dict.fromkeys(inside.get((r[0],r[1]),[])))[:400] if r[2] in ('MISSING','one-off only') else '')
with open(os.path.join(OUTDIR,'coverage.csv'),'w',newline='',encoding='utf-8') as f:
    w=csv.writer(f); w.writerow(['book','chapter','status','primary_date','primary_link','commentary_chars','other_versions','text_also_appears_inside']); w.writerows(rows)
print('Chapters by status:',dict(Counter(r[2].split(' (')[0] for r in rows)))
print('Not covered by a series (excluding Psalms):',[f'{r[0]} {r[1]}' for r in rows if not r[2].startswith('series') and r[0]!='Psalms'])
print('Output written to',os.path.abspath(OUTDIR))
