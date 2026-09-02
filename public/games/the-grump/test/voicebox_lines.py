import json, time, urllib.request, sys, os
BASE='http://127.0.0.1:17493'; PROFILE='1346da39-8750-4ac7-91c4-3addd0e29745'
OUT='/mnt/d/ImagineX/imaginex-console/public/games/the-grump/audio/'
LINES = {
 'pat_quick_question': 'Song, quick question.',
 'pat_got_a_sec': 'Got a sec?',
 'pat_five_minutes': 'This should only take five minutes.',
 'pat_idea': "I've got an idea!",
 'pat_meeting': 'I scheduled us a meeting.',
 'pat_quick_look': 'Can you take a quick look at this?',
 'pat_before_you_go': 'Hey Song, before you go...',
 'pat_busy': 'You look busy! Anyway...',
 'pat_told_them': "I told them you'd handle it.",
 'pat_not_busy': "You're not busy, right?",
 'pat_added_you': 'I added you to the meeting.',
 'pat_quick_call': 'Can you jump on a quick call?',
 'pat_said_yes': 'I already told them you said yes.',
 'pat_hear_me_out': 'Song, hear me out.',
 'pat_mentioned_name': 'I may have mentioned your name.',
 'pat_hold_the_door': 'Song! Hold the door!',
 'pat_rkt': 'Ooh, are those Rice Krispy Treats?',
}
def req(method, path, payload=None, raw=False):
    data=json.dumps(payload).encode() if payload is not None else None
    r=urllib.request.Request(BASE+path, data=data, headers={'Content-Type':'application/json'}, method=method)
    with urllib.request.urlopen(r, timeout=120) as resp: return resp.read() if raw else json.loads(resp.read())
for name, text in LINES.items():
    if os.path.exists(OUT+name+'.wav'): print(name,'exists',flush=True); continue
    t0=time.time(); g=req('POST','/generate',{'profile_id':PROFILE,'text':text,'language':'en'}); gid=g['id']
    for i in range(600):
        s=req('GET',f'/history/{gid}'); st=s.get('status')
        if st in ('completed','complete'): break
        if st in ('failed','error','cancelled'): print(name,'FAILED',s,flush=True); break
        time.sleep(2)
    else: print(name,'TIMEOUT',flush=True); continue
    if st in ('completed','complete'):
        wav=req('GET',f'/audio/{gid}',raw=True); open(OUT+name+'.wav','wb').write(wav)
        print(name,'DONE',round(time.time()-t0),'s',len(wav),'bytes',flush=True)
print('ALL DONE',flush=True)
