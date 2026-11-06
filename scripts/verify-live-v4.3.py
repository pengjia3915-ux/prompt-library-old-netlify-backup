from pathlib import Path
import concurrent.futures,datetime,hashlib,json,re,urllib.request,urllib.error
from html.parser import HTMLParser
root=Path(__file__).resolve().parents[1]
client=root/'dist/client'
base='https://prompt-library-pengjia3915.netlify.app/'
class CanonicalHTML(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.tokens=[]
 def handle_starttag(self,tag,attrs):
  normalized=[]
  for key,value in attrs:
   if key=='href' and value and not re.match(r'^(https?:|#|mailto:)',value):
    value=urllib.parse.urljoin(base,value)
    value=value.replace('/index.html','/')
    value=re.sub(r'\.html(?=[?#]|$)','',value)
   normalized.append((key,value))
  self.tokens.append(('start',tag,sorted(normalized)))
 def handle_endtag(self,tag):self.tokens.append(('end',tag))
 def handle_data(self,data):self.tokens.append(('text',data.replace('\r\n','\n')))
 def handle_entityref(self,name):self.tokens.append(('entity',name))
 def handle_charref(self,name):self.tokens.append(('char',name))
def canonical(body):
 p=CanonicalHTML();p.feed(body.decode('utf-8'));return p.tokens
def fetch(path):
 with urllib.request.urlopen(urllib.request.Request(base+path,headers={'Cache-Control':'no-cache','User-Agent':'PromptLibraryReleaseVerification/4.3'}),timeout=45) as r:return r.status,r.read()
sw=(client/'service-worker.js').read_text(encoding='utf-8')
section=sw[sw.index('const CORE_ASSETS'):sw.index('const NETWORK_FIRST_PATHS')]
paths=list(dict.fromkeys([v.removeprefix('./') for v in re.findall(r'"(\./[^"]*)"',section)]+['service-worker.js','data/pose-reference/img/full_single_P001_front.png','data/pose-reference/img/pair60_P030_diag.png','data/pose-reference/img/full_single_P049_side.png']))
def verify(p):
 name=p.split('?')[0] or 'index.html';status,body=fetch(p);local=(client/name).read_bytes()
 match=hashlib.sha256(body).digest()==hashlib.sha256(local).digest()
 normalized=not match and name.endswith('.html') and canonical(body)==canonical(local)
 assert match or normalized,('Live file differs',p)
 return {'path':p,'status':status,'bytes':len(body),'sha256Matches':match,'expectedHtmlLinkRewrite':normalized}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:results=list(pool.map(verify,paths))
excluded={}
for p in ['scene-reference.html','data/scene-reference/catalog.json','data/scene-reference/images/scn-001.png','reports/costume-caption-review/README.md','reports/scene-reference/desktop.png']:
 try:status,_=fetch(p)
 except urllib.error.HTTPError as e:status=e.code
 excluded[p]=status
assert all(s==404 for s in excluded.values()),excluded
try:sync_status,_=fetch('api/sync')
except urllib.error.HTTPError as e:sync_status=e.code
assert sync_status in [400,401,403],sync_status
costumes=json.loads(fetch('data/costume-reference/catalog.json')[1]);captions=json.loads(fetch('data/costume-reference/text-prompts.json?v=4.3.0')[1])
assert len(costumes['items'])==len(captions['entries'])==1407
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'4.3','deployId':json.loads((root/'reports/release-v4.3-deploy.json').read_text())['deployId'],'verified':len(results),'allMatched':True,'results':results,'excludedUrls':excluded,'syncUnauthenticatedStatus':sync_status,'costumes':1407,'captions':1407}
(root/'reports/release-v4.3-online-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['version','deployId','verified','allMatched','excludedUrls','syncUnauthenticatedStatus','costumes']}))
