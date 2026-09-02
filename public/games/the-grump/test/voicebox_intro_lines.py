# Intro cinematic voice lines via the local Voicebox API. Narrator = Kokoro preset "Onyx" (deep male) in a
# preset profile named "Narrator" (created on first run); Pat's cut-off line = the cloned Pat profile.
# Re-run to regenerate any missing audio/narr_*.wav / pat_intro_coming.wav (skips existing files).
import json, time, urllib.request, os
BASE='http://127.0.0.1:17493'; PAT='1346da39-8750-4ac7-91c4-3addd0e29745'
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio') + os.sep
def req(method, path, payload=None, raw=False):
    data=json.dumps(payload).encode() if payload is not None else None
    r=urllib.request.Request(BASE+path, data=data, headers={'Content-Type':'application/json'}, method=method)
    with urllib.request.urlopen(r, timeout=120) as resp: return resp.read() if raw else json.loads(resp.read())
profs = req('GET','/profiles'); narr = next((p for p in profs if p['name']=='Narrator'), None)
if not narr:
    narr = req('POST','/profiles',{'name':'Narrator','description':'Movie-trailer narrator for The Grump intro','language':'en','voice_type':'preset','preset_engine':'kokoro','preset_voice_id':'am_onyx','default_engine':'kokoro'})
    print('created Narrator profile', narr['id'])
NARR = narr['id']
LINES = [
 ('narr_offices', NARR, 'kokoro', 'Amazon Corporate Offices. Monday. Eight A.M.'),
 ('narr_monday',  NARR, 'kokoro', 'For most people... it was just another Monday.'),
 ('narr_soung',   NARR, 'kokoro', 'For David Song...'),
 ('narr_worse',   NARR, 'kokoro', 'It was about to get... much worse.'),
 ('narr_goal',    NARR, 'kokoro', 'He had one goal. Survive until five P.M.'),
 ('pat_grab_chair', PAT, None, "I'll just grab a chair."),
 ('pat_intro_coming', PAT, None, 'Hey Song! I was just coming over because you'),
]
for name, prof, engine, text in LINES:
    if os.path.exists(OUT+name+'.wav'): print(name,'exists',flush=True); continue
    body={'profile_id':prof,'text':text,'language':'en'}
    if engine: body['engine']=engine
    t0=time.time(); g=req('POST','/generate',body); gid=g['id']
    for i in range(600):
        s=req('GET',f'/history/{gid}'); st=s.get('status')
        if st in ('completed','complete'): break
        if st in ('failed','error','cancelled'): print(name,'FAILED',s.get('error'),flush=True); break
        time.sleep(2)
    else: print(name,'TIMEOUT',flush=True); continue
    if st in ('completed','complete'):
        wav=req('GET',f'/audio/{gid}',raw=True); open(OUT+name+'.wav','wb').write(wav); print(name,'DONE',round(time.time()-t0),'s',len(wav),'bytes',flush=True)
print('ALL DONE',flush=True)
