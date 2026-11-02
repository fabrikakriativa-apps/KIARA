// Worker de homologação INDEPENDENTE, sem webhooks, queues ou acesso ao CRM.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== '/health') {
      return new Response('Not found', { status: 404 });
    }
    return Response.json({ service: 'kiara-homologacao', status: 'ok', version: 1 },
      { headers: { 'cache-control': 'no-store' } });
  }
};
