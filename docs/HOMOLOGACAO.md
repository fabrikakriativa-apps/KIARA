# Homologação da Kiara

O GitHub está conectado ao Cloudflare, mas a integração **não deve publicar automaticamente** enquanto o Worker de produção não for exportado e comparado.

1. Confirmar **Disable builds** ligado no Cloudflare.
2. Exportar o Worker real e comparar com o candidato preparado separadamente.
3. Reconciliar histórico, fila `kiara-respostas`, KV `CONVERSAS`, webhook EasyCoexistence e Meta; nunca inventar bindings.
4. Copiar e revisar as variáveis e secrets usando somente o ambiente protegido da Cloudflare.
5. Testar com o número autorizado; não encaminhar mensagens a clientes reais.
6. Testar segurar antes e durante geração, intervenção humana, liberação repetida e falhas do Supabase.
7. Só então revisar branch de produção, deploy e plano de reversão.

**Não habilitar builds, não publicar e não sobrescrever o Worker atual sem validar estes pontos.**
