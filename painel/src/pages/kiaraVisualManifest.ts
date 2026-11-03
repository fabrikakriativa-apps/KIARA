// Manifesto das 22 referências revisadas pela Fábrika.
// Nomes são chaves de importação; não são mostrados automaticamente a clientes.
export type ReferencePreset={filename:string;product:'cortina'|'persiana';category:'produto'|'modelo_confeccao'|'composicao';model:string;title:string;description:string}
const entries:[string,ReferencePreset['product'],ReferencePreset['category'],string,string,string][]=[
 ['cortina-blackout-com-face-frontal.jpg','cortina','produto','Composição de cortina','Blackout com camada frontal','Cortina com duas camadas de tecido. Confirmar composição.'],
 ['cortina-blackout-off-white.png','cortina','produto','Blackout','Blackout off-white','Exemplo de cortina blackout em tom claro.'],
 ['cortina-gaze-de-linho.png','cortina','produto','Gaze de linho','Gaze de linho','Tecido leve com textura natural.'],
 ['cortina-semi-blackout-off-white.png','cortina','produto','Semi-blackout','Semi-blackout off-white','Tecido encorpado que filtra luz.'],
 ['cortina-linho-fresh-claridade-media.jpg','cortina','produto','Linho Fresh','Linho Fresh — claridade média','Referência visual de passagem de luz.'],
 ['cortina-linho-morea-com-forro.jpg','cortina','produto','Linho Morea com forro','Linho Morea com forro','Cortina frontal com forro de tecido.'],
 ['cortina-linho-trama-media.jpg','cortina','produto','Linho — trama média','Linho de trama média','Tecido com trama intermediária.'],
 ['cortina-face-voil-ambiente.png','cortina','produto','Face frontal (voil)','Cortina — face frontal','Face da frente, que pode ser feita em qualquer tecido adequado.'],
 ['persiana-rolo-1pct-bege.jpg','persiana','produto','Rolô tela 1%','Rolô 1% — bege','Referência de tela 1%.'],
 ['persiana-rolo-1pct-off-white.jpg','persiana','produto','Rolô tela 1%','Rolô 1% — off-white','Referência visual de tela 1%; não prometer desempenho térmico sem ficha técnica.'],
 ['persiana-rolo-3pct-off-white.png','persiana','produto','Rolô tela 3%','Rolô 3% — off-white','Referência de tela solar 3%.'],
 ['persiana-silonew-off-white.png','persiana','produto','Silonew','Silonew — off-white','Faixas alternadas; conferir nomenclatura comercial.'],
 ['persiana-blackout-guia-lateral.png','persiana','produto','Blackout com guia lateral','Blackout com guia lateral','Exemplo de persiana com guias laterais.'],
 ['persiana-madeira-aberta.jpg','persiana','produto','Madeira horizontal','Madeira — aberta','Lâminas abertas.'],
 ['persiana-madeira-fechada.jpg','persiana','produto','Madeira horizontal','Madeira — fechada','Lâminas fechadas.'],
 ['persiana-vig-blind-tela-rustica.jpg','persiana','produto','Vig Blind','Vig Blind — tela rústica','Conferir modelo no catálogo do fornecedor.'],
 ['persiana-romana-blackout.jpg','persiana','produto','Romana blackout','Romana — blackout','Dobras horizontais em configuração blackout.'],
 ['persiana-romana-convencional.jpg','persiana','produto','Romana convencional','Romana — convencional','Dobras horizontais.'],
 ['composicao-persiana-atras-cortina-frente.png','cortina','composicao','Cortina frontal + persiana atrás','Composição — cortina e persiana','Persiana atrás como forro; cortina na frente, face chamada voil independentemente do tecido.'],
 ['cortina-prega_macho.jpg','cortina','modelo_confeccao','Prega macho','Cortina — prega macho','Pregas estruturadas com desenho marcado.'],
 ['cortina-prega_franzida.jpg','cortina','modelo_confeccao','Prega franzida','Cortina — prega franzida','Franzimento distribuído e caimento clássico.'],
 ['cortina-wave.jpg','cortina','modelo_confeccao','Wave','Cortina — wave','Ondas contínuas e regulares.'],
]
export const kiaraVisualManifest:ReferencePreset[]=entries.map(([filename,product,category,model,title,description])=>({filename,product,category,model,title,description}))
