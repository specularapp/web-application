import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { ContractLookups } from "../store";
import type { Contract } from "../summary";
import { ContractEditor } from "./contract-editor";
import styles from "./contracts-screen.module.css";

export type ContractEditorScreenProps = {
  contract: Contract;
  lookups: ContractLookups;
  ai: AiUsage;
  aiAvailable: boolean;
};

// A tela do editor de contrato: o topo padrão da aplicação, com o nome trocado, e o editor tomando o resto.
// Server Component na mesma moldura da lista; quem tem estado é o editor.
export function ContractEditorScreen({ contract, lookups, ai, aiAvailable }: ContractEditorScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar title="Editor de contrato" ai={ai} />
      <ContractEditor contract={contract} lookups={lookups} aiAvailable={aiAvailable} />
    </div>
  );
}
