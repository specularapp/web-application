"use client";

import styled from "@emotion/styled";
import { ArrowClockwiseIcon, UsersThreeIcon, XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { planBadges } from "@/features/billing/plans";
import { ImageGroup, ImagePicker } from "@/features/onboarding/components/image-picker";
import { industryOptions, roleLabels } from "@/features/onboarding/labels";
import { loadTeamAction, loadTeamPeopleAction, saveTeamAction, switchTeamAction } from "../actions";
import { CREATE_TEAM_PLAN } from "../constants";
import { organizationLimits, type ImageKind, type OrganizationIndustry } from "../schemas";
import type { TeamPeople } from "../service";
import { uploadTeamImage } from "../upload";
import { TeamPeoplePanel, type TeamSectionProps } from "./team-people";
import { callAction } from "@/lib/action";
import { onlyDigits } from "@/lib/masks";
import { siteValue } from "@/lib/utils/site";

/** Quem está criando: entra na lista de pessoas já como proprietário, porque é o que o banco fará. */
export type TeamOwner = { name: string; email: string | null; avatarUrl: string | null };

export type CreateTeamPanelProps = {
  open: boolean;
  onClose: () => void;
  owner: TeamOwner;
  /**
   * O id da equipe que está sendo editada; ausente, a gaveta cria uma nova (2026-09-16, a pedido de editar
   * equipe pelo menu do seletor). Editando, a gaveta abre preenchida, mostra a gente de verdade da equipe com
   * o convite que sai na hora, e salvar não troca de contexto: quem edita já está onde quer estar.
   */
  teamId?: string | null;
};

type Picked = { file: File | null; preview: string | null };

const empty: Picked = { file: null, preview: null };

/** O formulário sem nada: é o que a gaveta mostra enquanto a equipe pedida está sendo lida. */
const blank = {
  name: "",
  website: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  industry: undefined as OrganizationIndustry | undefined,
  logo: empty,
  banner: empty,
};

/** Plano que libera criar equipe. A etiqueta sai daqui no topo da gaveta e no convite que a abre. */
/* O código do plano mora em `../constants`, que não carrega componente nenhum: quem só quer o código
   não precisa levar esta gaveta junto. Segue exportado aqui para quem já o importava daqui. */
export { CREATE_TEAM_PLAN };

/** O recado da falha de leitura da gente: sai no aviso e na moldura de erro, então é o mesmo texto nos dois. */
const PEOPLE_FAILED = "Não deu para ler quem está na equipe";

/* Fio da casa, o mesmo do menu: 0,6px na cor mais discreta da paleta. A variável nasce na janela e
   desce por cascata para o cabeçalho, o divisor e o rodapé, então os três nunca saem de sincronia. */
const Drawer = styled(Dialog)`
  --panel-line: 0.0375rem;
`;

const Header = styled.header`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-block-end: var(--panel-line) solid var(--color-border);
`;

const Close = styled.span`
  flex-shrink: 0;
  margin-inline-start: auto;
`;

/* Dois `&` de propósito: o módulo do Separator alveja `.separator[data-orientation]`, e uma classe
   simples do Emotion perderia. A cor dele é `--color-separator`, quase três vezes mais opaca que a
   borda, e numa coluna estreita ela vira um risco preto no meio do formulário. */
const Divider = styled(Separator)`
  &&[data-orientation="horizontal"] {
    height: var(--panel-line);
    background-color: var(--color-border);
  }
`;

/* `align-content: start` é obrigatório aqui: a coluna cresce para preencher a gaveta e, no padrão
   `stretch`, as linhas de altura automática esticam para dividir a sobra, então os blocos abriam
   como se houvesse space-between. A leitura é de cima para baixo, e a sobra fica no fim. */
const Scroll = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--space-5);
  flex: 1;
  min-height: 0;
  padding-block: var(--space-5);
  overflow-y: auto;
  overscroll-behavior: contain;

  /* No celular criar e sair estão na barra flutuante, acima da bandeja: o corpo leva a folga dela embaixo,
     para a última linha fechar acima da barra. */
  @media (max-width: 47.9375rem) {
    padding-block-end: var(--floating-bar-inset);
  }
`;

/* A gaveta é coluna estreita: o banner deita mais e a bola encolhe, senão ela cobre quase toda a
   capa. O quanto ela transborda continua saindo do próprio tamanho dela. */
const Identity = styled(ImageGroup)`
  --identity-ratio: 3 / 1;
  --identity-logo-size: 5rem;

  margin-inline: var(--space-5);
`;

/* O recuo lateral mora em cada bloco, e não na coluna: assim o divisor corre de ponta a ponta sem
   margem negativa, que dentro de um container que rola é cortada de um lado e vira rolagem do outro,
   que era o pedaço faltando na linha. */
const Fields = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--space-3);
  min-width: 0;
  padding-inline: var(--space-5);
`;

const Section = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--space-4);
  min-width: 0;
  padding-inline: var(--space-5);
`;

const Pair = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-3);
  align-items: end;

  @media (max-width: 47.9375rem) {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
  }
`;

const People = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-3);
`;

const Person = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
`;

const PersonText = styled.div`
  display: grid;
  flex: 1;
  gap: var(--space-half);
  min-width: 0;
`;

/* No celular o rodapé some: criar e sair moram na barra flutuante do menu, e a folga para ela vem da
   própria bandeja, pela regra geral do `Dialog`. */
const Footer = styled.footer`
  display: flex;
  flex-shrink: 0;
  gap: var(--space-3);
  justify-content: flex-end;
  padding: var(--space-4) var(--space-5);
  border-block-start: var(--panel-line) solid var(--color-border);

  @media (max-width: 47.9375rem) {
    display: none;
  }
`;

const SectionHead = styled.div`
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
`;

/* A moldura de um bloco de pessoas dentro da gaveta: o `TeamPeoplePanel` é o mesmo da página da equipe, e o
   que muda entre os dois é só isto, a caixa em volta. */
function DrawerSection({ title, aside, children }: TeamSectionProps) {
  /* O nome da região sai do próprio título, como no `Card` da página: repetir o texto num `aria-label` faria
     o leitor de tela anunciar a mesma palavra duas vezes para a mesma seção. */
  const id = useId();

  return (
    <Section aria-labelledby={id}>
      <SectionHead>
        <Text as="h3" id={id} variant="subheadline" weight="semibold">
          {title}
        </Text>
        {aside}
      </SectionHead>
      {children}
    </Section>
  );
}

// Criar equipe numa gaveta à direita: identidade, dados e pessoas numa lista só, do jeito que os
// primeiros passos já pedem, mas sem etapas, porque aqui quem cria já conhece o produto. A equipe
// nasce pela mesma `saveTeamAction` da configuração inicial, e a pessoa já entra nela.
export function CreateTeamPanel({ open, onClose, owner, teamId = null }: CreateTeamPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [industry, setIndustry] = useState<OrganizationIndustry | undefined>(undefined);
  const [logo, setLogo] = useState<Picked>(empty);
  const [banner, setBanner] = useState<Picked>(empty);
  const [saving, setSaving] = useState(false);
  /* Qual equipe já foi lida. Guardando o id, e não um "carregando" ligado na hora, o efeito não escreve
     estado de forma síncrona, que é o que a regra de hooks da casa barra, e reabrir a gaveta na mesma equipe
     não pede o dado de novo. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [people, setPeople] = useState<TeamPeople | null>(null);
  /** Por que não há bloco de gente: sem isto a falha de leitura sumia com a lista sem dizer nada. */
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const editing = Boolean(teamId);
  const loading = editing && loadedFor !== teamId;
  /* Enquanto a equipe não chega, o formulário fica desligado: a leitura escreve em cima dos campos, então o
     que fosse digitado aqui seria apagado quando o dado aparecesse. */
  const locked = saving || loading;

  /* Carregando, o formulário aparece vazio em vez de mostrar a equipe anterior: o seletor mantém esta gaveta
     montada de uma edição para a outra, então o estado sobrevive ao fechar. Limpar o estado aqui seria
     escrever de dentro do efeito, que a regra de hooks da casa barra, então quem decide o que aparece é a
     leitura, e não o que sobrou. */
  const shown = loading ? blank : { name, website, email, phone, city, state, industry, logo, banner };

  /* Relê só a gente, e não a equipe toda: quem chega a esta moldura pode já ter corrigido os campos, e uma
     segunda leitura da equipe escreveria em cima do que ele digitou. */
  const readPeople = async () => {
    if (!teamId || reading) return;
    setReading(true);
    const crew = await callAction(loadTeamPeopleAction({ organizationId: teamId }));
    setReading(false);
    if (!crew.ok) {
      setPeople(null);
      setPeopleError(crew.error);
      toast({ title: PEOPLE_FAILED, description: crew.error, tone: "danger" });
      return;
    }
    setPeopleError(null);
    setPeople(crew.data);
  };

  const reset = () => {
    setPeople(null);
    setPeopleError(null);
    setName("");
    setWebsite("");
    setEmail("");
    setPhone("");
    setCity("");
    setState("");
    setIndustry(undefined);
    setLogo(empty);
    setBanner(empty);
  };

  /* Editando, a gaveta lê a equipe ao abrir: o seletor só conhece nome e logo, e o resto (o ramo, o site, a
     capa) está no banco. Enquanto não chega, os campos ficam vazios e desligados por `locked`, senão salvar
     cedo gravaria em cima do que ainda não apareceu. */
  useEffect(() => {
    if (!open || !teamId || loadedFor === teamId) return;
    let live = true;
    /* A equipe e a gente dela na mesma abertura: sem a segunda leitura o bloco de pessoas nasceria vazio e
       encheria depois, e o convite precisa do papel de quem está olhando para aparecer. */
    void Promise.all([
      loadTeamAction({ organizationId: teamId }),
      loadTeamPeopleAction({ organizationId: teamId }),
    ]).then(([result, crew]) => {
      if (!live) return;
      if (!result.ok) {
        /* Sem gravar `loadedFor`: a gaveta segue desligada, e reabri-la tenta a leitura de novo. */
        toast({ title: "Não deu para abrir a equipe", description: result.error, tone: "danger" });
        return;
      }
      /* A lista velha sai junto com o erro novo: `getTeam` lê `organizations` e `getTeamPeople` exige o nome
         de quem pede entre os membros, então a equipe abre e a gente dela falha. Guardando a lista anterior,
         a gaveta desenhava o time de antes com o id do time de agora, e a moldura de erro nunca aparecia. */
      if (crew.ok) {
        setPeopleError(null);
        setPeople(crew.data);
      } else {
        setPeople(null);
        setPeopleError(crew.error);
        toast({ title: PEOPLE_FAILED, description: crew.error, tone: "danger" });
      }
      setLoadedFor(teamId);
      setName(result.data.name);
      setWebsite(result.data.website ?? "");
      setEmail(result.data.email ?? "");
      setPhone(result.data.phone ?? "");
      setCity(result.data.city ?? "");
      setState(result.data.state ?? "");
      setIndustry(result.data.industry ?? undefined);
      setLogo({ file: null, preview: result.data.logoUrl });
      setBanner({ file: null, preview: result.data.bannerUrl });
    });
    return () => {
      live = false;
    };
  }, [open, teamId, loadedFor, toast]);

  const filled = name.trim().length >= 2 && Boolean(industry);

  // Revogar em limpeza de efeito quebraria no modo estrito, que desmonta e remonta: o endereço seria
  // descartado com a imagem ainda na tela. Aqui o anterior sai quando deixa de ser usado.
  const choose = (current: Picked, apply: (next: Picked) => void) => (file: File) => {
    if (current.preview?.startsWith("blob:")) URL.revokeObjectURL(current.preview);
    apply({ file, preview: URL.createObjectURL(file) });
  };

  const reject = (message: string) => toast({ title: "Arquivo recusado", description: message, tone: "danger" });

  const sendImage = async (organizationId: string, picked: Picked, kind: ImageKind) => {
    if (!picked.file) return;
    const result = await uploadTeamImage(organizationId, picked.file, kind);
    if (!result.ok) toast({ title: "A imagem não subiu", description: result.error, tone: "warning" });
  };

  const close = () => {
    if (saving) return;
    onClose();
  };

  const create = async () => {
    if (saving || loading || !industry) return;
    setSaving(true);

    const result = await callAction(
      saveTeamAction({ ...(teamId ? { organizationId: teamId } : {}), name, industry, website, email, phone, city, state }),
    );
    if (!result.ok) {
      toast({
        title: editing ? "Não foi possível salvar a equipe" : "Não foi possível criar a equipe",
        description: result.error,
        tone: "danger",
      });
      setSaving(false);
      return;
    }

    const team = result.data;

    /* Editando, o caminho acaba aqui: as imagens sobem, e não há convite para mandar nem contexto para
       trocar, porque a pessoa já está na equipe que acabou de arrumar. */
    if (editing) {
      await Promise.all([sendImage(team.id, logo, "logo"), sendImage(team.id, banner, "banner")]);
      setSaving(false);
      toast({ title: "Equipe salva", description: `${team.name} está atualizada.`, tone: "success" });
      onClose();
      router.refresh();
      return;
    }

    // As imagens não seguram a gaveta: a equipe já existe e cada envio custa uma ida ao servidor. Falha
    // avisa por toast.
    void Promise.all([sendImage(team.id, logo, "logo"), sendImage(team.id, banner, "banner")]).catch(() => null);

    const entered = await callAction(switchTeamAction({ organizationId: team.id }));
    setSaving(false);

    if (entered.ok) {
      toast({ title: "Equipe criada", description: `Você já está em ${team.name}`, tone: "success" });
    } else {
      toast({ title: "Equipe criada", description: "Não foi possível entrar nela agora.", tone: "warning" });
    }

    reset();
    onClose();
    router.refresh();
  };

  // No celular criar e sair moram na barra flutuante do menu, acima da bandeja, e o rodapé some: a mesma
  // dinâmica da ficha do cliente. Registra só enquanto a gaveta está aberta.
  const mobile = useMediaQuery(MOBILE_QUERY);
  useFloatingActionsRegistration(
    open
      ? {
          primary: { label: saving ? "Salvando" : editing ? "Salvar" : "Criar", loading: saving, disabled: !filled || loading, onClick: () => void create() },
          cancel: { label: "Cancelar", onClick: close },
        }
      : null,
  );

  return (
    // Sem o fundo que escurece no desktop: fechar por toque fora entra no lugar do clique no fundo. No
    // celular o escurecimento entra, senão o toque na barra flutuante, que fica acima da bandeja, fecharia
    // a gaveta como toque fora.
    <Drawer
      open={open}
      onClose={close}
      label={editing ? "Editar equipe" : "Criar equipe"}
      size="md"
      placement="end"
      surface="glass"
      scrim={mobile}
    >
      <Header>
        <Text as="h2" variant="headline" weight="semibold">
          {editing ? "Editar equipe" : "Criar equipe"}
        </Text>
        <Badge tone="neutral" variant="soft" size="sm">
          {planBadges[CREATE_TEAM_PLAN]}
        </Badge>
        <Close>
          <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={close}>
            <XIcon />
          </IconButton>
        </Close>
      </Header>

      <Scroll>
        <Identity>
          <ImagePicker
            variant="banner"
            label="o banner da equipe"
            hint="1200 × 300"
            preview={shown.banner.preview}
            disabled={locked}
            onSelect={choose(banner, setBanner)}
            onReject={reject}
          />
          <ImagePicker
            variant="logo"
            label="a logo da equipe"
            hint="512 × 512"
            preview={shown.logo.preview}
            disabled={locked}
            onSelect={choose(logo, setLogo)}
            onReject={reject}
          />
        </Identity>

        <Fields>
          <Field label="Nome da equipe">
            <Input
              type="text"
              name="name"
              value={shown.name}
              maxLength={organizationLimits.name}
              placeholder="Como a equipe se chama"
              autoComplete="organization"
              required
              disabled={locked}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Pair>
            <Field label="Site">
              <Input
                type="text"
                name="website"
                value={shown.website}
                placeholder="seusite.com.br"
                autoComplete="url"
                inputMode="url"
                spellCheck={false}
                disabled={locked}
                iconStart={<FieldAffix data-tone="muted">https://</FieldAffix>}
                onChange={(event) => setWebsite(siteValue(event.target.value))}
              />
            </Field>

            <Field label="Área de atuação">
              <Select
                label="Área de atuação"
                options={industryOptions}
                value={shown.industry}
                placeholder="Escolha a área"
                disabled={locked}
                onChange={setIndustry}
              />
            </Field>
          </Pair>

          <Pair>
            <Field label="E-mail comercial">
              <Input
                type="email"
                name="email"
                value={shown.email}
                maxLength={organizationLimits.email}
                placeholder="contato@empresa.com.br"
                autoComplete="email"
                inputMode="email"
                disabled={locked}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            <Field label="Telefone comercial">
              <Input
                type="tel"
                name="phone"
                mask="phone"
                value={shown.phone}
                placeholder="(11) 99999-9999"
                autoComplete="tel-national"
                disabled={locked}
                onChange={(event) => setPhone(onlyDigits(event.target.value))}
              />
            </Field>
          </Pair>

          <Pair>
            <Field label="Cidade">
              <Input
                type="text"
                name="city"
                value={shown.city}
                maxLength={organizationLimits.city}
                placeholder="São Paulo"
                autoComplete="address-level2"
                disabled={locked}
                onChange={(event) => setCity(event.target.value)}
              />
            </Field>

            <Field label="Estado">
              <Input
                type="text"
                name="state"
                value={shown.state}
                maxLength={2}
                placeholder="SP"
                autoComplete="address-level1"
                disabled={locked}
                onChange={(event) => setState(event.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase())}
              />
            </Field>
          </Pair>
        </Fields>

        {/* Editando, entra a gente de verdade da equipe (2026-09-21, a pedido): quem está dentro, com o papel
            de cada um, os convites pendentes e o convite novo, que sai na hora. É o mesmo bloco da página da
            equipe, com a moldura da gaveta. Criando, não há convite: a equipe ainda não existe para convidar
            para, e o plano em que ela nasce não tem lugar para uma segunda pessoa. */}
        {teamId && !loading && people && (
          <>
            <Divider />

            {/* Uma chave por equipe: trocando de equipe no seletor, a lista e o campo de convite nascem de
                novo em vez de herdarem o que estava escrito para a anterior. */}
            <TeamPeoplePanel
              key={teamId}
              organizationId={teamId}
              members={people.members}
              invites={people.invites}
              viewer={people.viewer}
              section={DrawerSection}
              busy={saving}
            />
          </>
        )}

        {/* A leitura da gente falhou: o bloco continua na tela dizendo por que, em vez de desaparecer e
            deixar a gaveta parecendo uma equipe sem ninguém, que é o que ela parecia até aqui. */}
        {teamId && !loading && !people && peopleError !== null && (
          <>
            <Divider />

            <DrawerSection title="Pessoas">
              <EmptyState size="sm" icon={UsersThreeIcon} title={PEOPLE_FAILED} description={peopleError}>
                <Button
                  variant="secondary"
                  size="sm"
                  radius="md"
                  loading={reading}
                  iconStart={<ArrowClockwiseIcon />}
                  onClick={() => void readPeople()}
                >
                  {reading ? "Lendo" : "Tentar de novo"}
                </Button>
              </EmptyState>
            </DrawerSection>
          </>
        )}

        {!editing && (
          <>
            <Divider />

            {/* Criando, a gaveta diz quem vai estar dentro e não pede convite (2026-09-22, na varredura):
                equipe nova nasce no plano gratuito, que é de uma pessoa, e o dono já ocupa esse lugar, então
                todo convite recolhido aqui voltava recusado pelo teto depois de a equipe existir. Quem quer
                gente convida pelo bloco de pessoas, ao editar a equipe, com o plano dela já escolhido. */}
            <DrawerSection title="Pessoas">
              <People>
                <Person>
                  <Avatar name={owner.name} src={owner.avatarUrl ?? undefined} seed={owner.email ?? owner.name} size="md" />
                  <PersonText>
                    <Text variant="subheadline" weight="medium" truncate>
                      {owner.name}
                    </Text>
                    <Text variant="footnote" tone="secondary" truncate>
                      {owner.email ?? "Quem está criando"}
                    </Text>
                  </PersonText>
                  <Badge tone="neutral" variant="soft" size="sm">
                    {roleLabels.owner}
                  </Badge>
                </Person>
              </People>

              <Text variant="footnote" tone="secondary">
                A equipe nasce no plano gratuito, que é de uma pessoa. Mude o plano dela para convidar mais
                gente, pelo bloco de pessoas ao editar a equipe.
              </Text>
            </DrawerSection>
          </>
        )}
      </Scroll>

      <Footer>
        <Button variant="ghost" size="md" disabled={saving} onClick={close}>
          Cancelar
        </Button>
        {/* O mesmo desligar da barra flutuante do celular: com a equipe ainda sendo lida `create()` sai
            calado, e um botão que aceita o clique e não faz nada não explica nada. */}
        <Button size="md" loading={saving} disabled={!filled || loading} onClick={() => void create()}>
          {saving ? "Salvando" : editing ? "Salvar equipe" : "Criar equipe"}
        </Button>
      </Footer>
    </Drawer>
  );
}
