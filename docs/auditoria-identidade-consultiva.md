# Kiara — auditoria da identidade consultiva
Data: 2026-11-04
Escopo: branch `homologacao`. Não publicar automaticamente no WhatsApp Business.

## Diagnóstico
A orientação para a IA estava distribuída pelo grande bloco `INSTRUCTIONS`, por quatro políticas concatenadas no final do fluxo (identificação, memória, tom, consultoria e encaminhamento), e por frases de atendimento dentro da matriz de orçamento. Isso criava duplicações e frequentemente priorizava preencher campos em vez de entender a pessoa.

O histórico é recuperado desde o último comando explícito de reinício. Um dado antigo é útil, mas não significa que o cliente aceitou um produto proposto no atendimento atual. Qualificação para orçamento e decisão de produto não devem ser confundidas.

## Responsabilidades após a refatoração
| Arquivo | Responsabilidade | Não deve fazer |
| --- | --- | --- |
| `src/consultative-identity.js` | Postura, escuta, memória contextual, perguntas, dúvidas e resumo antes do orçamento | Definir preços ou prescrever frases para cada perfil |
| `src/product-knowledge.js` | Informações técnicas de cortinas, persianas, composição e instalação | Obrigar fluxo comercial ou impor escolha |
| `src/operational-policy.js` | Limites comunicados ao modelo | Substituir os validadores de código |
| `src/worker.js` | Transporte, contexto atual, validações e execução de ações | Acumular novas regras de tom |
| `src/quote-intake.js` | Campos e restrições técnicas de pré-orçamento | Definir personalidade da atendente |

## Princípios não negociáveis
1. A Kiara se identifica como assistente digital, sem fingir ser humana.
2. A conversa é conduzida conforme a necessidade atual da pessoa, sem categorias fixas e sem repetir nome ou confirmação a cada turno.
3. Dados mencionados, propostas, alternativas em avaliação e escolhas expressamente confirmadas são diferentes.
4. Informações de ambientes distintos permanecem separadas; não se somam nem migram sem evidência.
5. O cliente pode pedir preço rapidamente: resposta direta, sem valores inventados.
6. O código continua bloqueando envio não autorizado e orçamento com cadastro incompleto.
7. O resumo de especificações ocorre próximo ao orçamento, de maneira curta, sem recontar toda a conversa.
8. Quando corrigida, a Kiara aceita a correção com uma resposta humana e objetiva; não explica sua memória nem narra erros internos.

## Cenários de aceitação
- Cliente responde apenas "Ana" após pergunta de identificação: reconhecer o nome e não repetir a pergunta.
- Pessoa pergunta "Como definir teto ou parede?": explicar benefícios e opções sem exigir escolha imediata.
- Cliente considera linho e depois diz "Ainda não decidi": retomar linho como possibilidade, não como produto aprovado.
- Dois ambientes: sala decorativa e quarto com controle de luminosidade; não presumir modelo nem usar medidas de outro ambiente.
- Cliente pede preço direto: atendimento breve e coleta apenas do necessário sem inventar números.
- Cliente corrige uma suposição: reconhecer com tato e retomar a orientação, sem relatório de erro.
- Antes de orçamento: recapitular uma vez por ambiente somente itens confirmados; separar os pendentes.

## Limites da validação
A suíte automatizada confirma sintaxe, estrutura, regras e integração simulada. Ela **não garante** que o modelo produza a resposta ideal em todas as conversas. Avaliar com respostas reais ou execução controlada do modelo (comparando a versão atual e esta revisão) antes de publicar no número Business.

## Publicação
Esta refatoração NÃO altera a produção nem dispara mensagens. Não alterar o workflow de publicação até aprovação da avaliação consultiva.
