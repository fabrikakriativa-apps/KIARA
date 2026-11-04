import os, json, urllib.request, urllib.error, uuid

token=os.environ['CF_TOKEN']
account=os.environ['CF_ACCOUNT']
base='https://api.cloudflare.com/client/v4/accounts/'+account
headers={'Authorization':'Bearer '+token,'Accept':'application/json'}

def call(method,url,body=None,extra=None):
    request_headers=dict(headers)
    if extra:
        request_headers.update(extra)
    request=urllib.request.Request(url,data=body,headers=request_headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=25) as response:
            return response.status,response.read()
    except urllib.error.HTTPError as error:
        return error.code,error.read()

status,raw=call('GET',base+'/storage/kv/namespaces?per_page=100')
if status!=200:
    raise SystemExit('Falha ao listar KV de homologação (HTTP '+str(status)+')')
payload=json.loads(raw)
matches=[item for item in payload.get('result',[]) if item.get('title')=='kiara-homologacao-controles']
if len(matches)!=1:
    raise SystemExit('Namespace exclusivo ausente ou duplicado')
namespace=matches[0]['id']

status,raw=call('GET',base+'/workers/scripts/fabrika-atendimento-ia-homologacao/settings')
if status!=200:
    raise SystemExit('Falha ao consultar bindings do Worker de homologação')
bindings=(json.loads(raw).get('result') or {}).get('bindings') or []
bound=any(item.get('type')=='kv_namespace' and item.get('name')=='KIARA_CONTROLES' and item.get('namespace_id')==namespace for item in bindings)
if not bound:
    raise SystemExit('Binding KIARA_CONTROLES não aponta para o namespace exclusivo')

key='teste-ci-'+uuid.uuid4().hex
url=base+'/storage/kv/namespaces/'+namespace+'/values/'+key
value=json.dumps({'environment':'homologacao','safe':True},separators=(',',':')).encode()
try:
    status,_=call('PUT',url,value,{'Content-Type':'application/json'})
    if status not in (200,204):
        raise SystemExit('Falha na escrita KV (HTTP '+str(status)+')')
    status,raw=call('GET',url)
    if status!=200 or json.loads(raw)!={'environment':'homologacao','safe':True}:
        raise SystemExit('Falha na leitura ou conteúdo divergente no KV')
    print('KV exclusivo validado: binding correto, escrita e leitura íntegra.')
finally:
    status,_=call('DELETE',url)
    if status not in (200,204,404):
        raise SystemExit('Falha ao limpar chave temporária do teste')
    print('Chave temporária removida; produção não acessada.')
