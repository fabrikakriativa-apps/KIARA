import {KiaraCoaching} from './KiaraCoaching'
import {KiaraKnowledgeLab} from './KiaraKnowledgeLab'
export function KiaraLearning(){
 return <section className="kiara-management"><h1>Instruções e aprendizados</h1><p>Registre regras gerais e revise os aprendizados propostos. As correções feitas dentro das conversas ficam vinculadas ao atendimento de origem.</p><p>Somente regras aprovadas devem alimentar respostas futuras. A extração automática de padrões e a recuperação dessas regras pelo Worker ainda dependem de homologação.</p><KiaraKnowledgeLab/><KiaraCoaching conversationId={null} selectedMessage={null} clearSelectedMessage={()=>{}}/></section>
}
