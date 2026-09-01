import { permanentRedirect } from "next/navigation";

// Endereço antigo: o Google Console e os links do produto apontam para /politica-de-privacidade.
export default function PrivacidadeRedirect() {
  permanentRedirect("/politica-de-privacidade");
}
