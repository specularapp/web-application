import { Topbar } from "@/components/layout/topbar";
import { buildWhatsappSample } from "../sample";
import { WhatsappInbox } from "./whatsapp-inbox";
import styles from "./whatsapp-screen.module.css";

/**
 * A tela do WhatsApp inteira: o topo padrão da aplicação, com o `h1`, e a caixa de entrada tomando o resto. Server
 * Component: quem tem estado é a caixa. Por enquanto ela lê dados de exemplo, montados aqui para o servidor e o
 * navegador desenharem as mesmas datas.
 */
export function WhatsappScreen() {
  const sample = buildWhatsappSample(new Date());
  return (
    <div className={styles.page}>
      <Topbar title="WhatsApp" />
      <WhatsappInbox sample={sample} />
    </div>
  );
}
