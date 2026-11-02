// Entrada segura da HOMOLOGAÇÃO. Importa o Worker real para validar compilação,
// mas não encaminha webhooks, fila, mensagens ou comandos para produção.
import kiara from '../src/worker.js';

if (!kiara || typeof kiara.fetch !== 'function' || typeof kiara.queue !== 'function') {
  throw new Error('O Worker da Kiara não exporta os handlers esperados.');
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({
        service: 'kiara-homologacao',
        status: 'ok',
        worker_code: 'integrado',
        external_integrations: 'blocked'
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json({error: 'Rota desativada na homologação isolada'},
      {status: 404, headers: {'Cache-Control': 'no-store'}});
  }
  // NÃO exportar queue. Não há evento consumidor nem chamada ao WhatsApp.
};
