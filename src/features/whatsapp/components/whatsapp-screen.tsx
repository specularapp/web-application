import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { buildWhatsappSample } from "../sample";
import { WhatsappInbox } from "./whatsapp-inbox";
import styles from "./whatsapp-screen.module.css";

/**
 * A tela do WhatsApp inteira: só a caixa de entrada, de ponta a ponta, sem o topo padrão (2026-10-26, a pedido: "tire
 * esse header, não tem necessidade nessa página"), como a da Le Ange; o `h1` segue para o leitor de tela. Server
 * Component: quem tem estado é a caixa. Por enquanto ela lê dados de exemplo, montados aqui para o servidor e o
 * navegador desenharem as mesmas datas.
 */
export function WhatsappScreen() {
  const sample = buildWhatsappSample(new Date());
  return (
    <div className={styles.page}>
      <VisuallyHidden as="h1">WhatsApp</VisuallyHidden>
      <WhatsappInbox sample={sample} />
    </div>
  );
}
