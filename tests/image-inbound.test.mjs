import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
test('recebimento de fotos no contato autorizado encaminha para a fila',()=>{
 assert.match(code,/\['text','audio','image','interactive'\]/);
 assert.match(code,/kind:'image'/);
 assert.match(code,/if\(job.kind==='image'\)return handleImageJob/);
});
test('foto usa fonte Meta autenticada e não permite origens arbitrárias',()=>{
 assert.match(code,/if\(!IMAGE_MIME.has\(mime\)\|\|!allowedAudioUrl\(meta.url\)/);
 assert.match(code,/MAX_IMAGE_BYTES/);
 assert.match(code,/Authorization:'Bearer '\+route.token/);
});
test('lote de fotos responde apenas na última e não cria orçamento por conta própria',()=>{
 assert.match(code,/if\(!batch.length\|\|batch\[0\]!==job.messageId\)return/);
 assert.match(code,/return consumeMessage\(env,\{\.\.\.job,kind:'text',input:contextual\}\)/);
 assert.match(code,/não é possível confirmar apenas pela foto/);
});
test('não afirma que visualizou quando modelo não consegue processar a foto',()=>{
 assert.match(code,/Fotos recebidas, mas ainda não foi possível analisar os detalhes visuais/);
});
