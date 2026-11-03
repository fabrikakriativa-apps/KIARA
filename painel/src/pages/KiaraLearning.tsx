import './KiaraLearning.css'
import {KiaraCoaching} from './KiaraCoaching'
import {KiaraKnowledgeLab} from './KiaraKnowledgeLab'
import {KiaraKnowledgeDocuments} from './KiaraKnowledgeDocuments'
export function KiaraLearning(){
 return <section className="kiara-management"><h1>Instruções e aprendizados</h1><p>Salve orientações gerais, localize regras existentes e gerencie as sugestões dos especialistas.</p><p>Suas orientações são aprovadas diretamente quando você administra o painel. As sugestões dos agentes continuam exigindo sua validação. A aplicação no atendimento depende da habilitação segura do Worker.</p><KiaraKnowledgeDocuments/><KiaraCoaching globalOnly conversationId={null} selectedMessage={null} clearSelectedMessage={()=>{}}/><KiaraKnowledgeLab/></section>
}
