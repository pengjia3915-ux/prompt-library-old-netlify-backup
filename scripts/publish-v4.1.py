from pathlib import Path
import json,hashlib,urllib.request,concurrent.futures,time,datetime
root=Path(r'D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app')
client=root/'dist/client'
(client/'_redirects').write_text('/api/sync /.netlify/functions/sync 200!\n',encoding='utf-8')
config=json.loads((Path.home()/'AppData/Roaming/netlify/Config/config.json').read_text())
u=next(iter(config['users'].values()));a=u.get('auth');token=a.get('token') if isinstance(a,dict) else a
if not token:token=u['token']
base='https://api.netlify.com/api/v1';site='b897359f-4774-462c-96f6-4f5263da9211'
def request(path,data=None,method=None,ctype='application/json',timeout=90):
 if isinstance(data,dict):data=json.dumps(data).encode()
 req=urllib.request.Request(base+path,data=data,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':ctype})
 try:
  with urllib.request.urlopen(req,timeout=timeout) as r:return json.load(r)
 except urllib.error.HTTPError as e:
  print('API error:',e.code,e.read().decode()[:1000],flush=True);raise
files={};byhash={}
for p in client.rglob('*'):
 if p.is_file():
  h=hashlib.sha1(p.read_bytes()).hexdigest();files['/'+p.relative_to(client).as_posix()]=h;byhash[h]=p
fn=Path(r'D:\Codex\Prompt-Library\prompt-library-old-netlify-publish\.netlify\functions\sync.zip')
fh=hashlib.sha256(fn.read_bytes()).hexdigest()
d=request('/sites/'+site+'/deploys',{'files':files,'functions':{'sync':fh},'functions_config':{'sync':{'build_data':{'bootstrapVersion':'2.18.0','runtimeAPIVersion':2},'priority':10}},'async':True,'draft':False,'title':'Prompt Library v4.1 - 251 pose groups'})
id=d['id'];print('Deploy created:',id,flush=True)
(root/'reports/release-v4.1-deploy.json').write_text(json.dumps({'deployId':id,'siteId':site,'previousDeploy':'6ae44eb64c04f114fa674166'},indent=2))
for i in range(30):
 d=request('/deploys/'+id)
 if d['state'] not in ['preparing','enqueued']:break
 time.sleep(2)
print('State:',d['state'],'required files:',len(d.get('required',[])),'functions:',d.get('required_functions',[]),flush=True)
def upload(h):
 p=byhash[h]
 for attempt in range(3):
  try:return request('/deploys/'+id+'/files/'+p.relative_to(client).as_posix(),p.read_bytes(),'PUT','application/octet-stream')
  except Exception:
   if attempt==2:raise
   time.sleep(10*(attempt+1))
for required in d.get('required_functions',[]):
 request('/deploys/'+id+'/functions/sync?runtime=nodejs24.x&invocation_mode=stream',fn.read_bytes(),'PUT','application/octet-stream')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for i,_ in enumerate(pool.map(upload,d.get('required',[])),1):
  if i%100==0:print('Uploaded',i,flush=True)
for i in range(60):
 d=request('/deploys/'+id)
 if d['state'] in ['ready','error']:break
 time.sleep(2)
print(json.dumps({k:d.get(k) for k in ['id','state','url','deploy_ssl_url','error_message']}),flush=True)
assert d['state']=='ready',d
