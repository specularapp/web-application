"use client";

import styled from "@emotion/styled";
import { PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { thinScrollbar } from "@/components/ui/styles";
import { Text } from "@/components/ui/text";
import { planBadges } from "@/features/billing/plans";
import { ImageGroup, ImagePicker } from "@/features/onboarding/components/image-picker";
import { industryOptions, invitableRoleOptions, roleLabels } from "@/features/onboarding/labels";
import { inviteMemberAction, saveTeamAction, switchTeamAction } from "../actions";
import type { ImageKind, InvitableRole, OrganizationIndustry } from "../schemas";
import { uploadTeamImage } from "../upload";

/** Quem está criando: entra na lista de pessoas já como proprietário, porque é o que o banco fará. */
export type TeamOwner = { name: string; email: string | null; avatarUrl: string | null };

export type CreateTeamPanelProps = {
  open: boolean;
  onClose: () => void;
  owner: TeamOwner;
};

type Picked = { file: File | null; preview: string | null };

type Guest = { id: string; email: string; name: string; role: InvitableRole };

const empty: Picked = { file: null, preview: null };

/** Plano que libera criar equipe. A etiqueta sai daqui no topo da gaveta e no convite que a abre. */
export const CREATE_TEAM_PLAN = "alliance" as const;

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
  ${thinScrollbar};
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

const PersonRole = styled.span`
  flex-shrink: 0;
  width: 9rem;
`;

const Footer = styled.footer`
  display: flex;
  flex-shrink: 0;
  gap: var(--space-3);
  justify-content: flex-end;
  padding: var(--space-4) var(--space-5);
  border-block-start: var(--panel-line) solid var(--color-border);
`;

// Criar equipe numa gaveta à direita: identidade, dados e pessoas numa lista só, do jeito que os
// primeiros passos já pedem, mas sem etapas, porque aqui quem cria já conhece o produto. A equipe
// nasce pela mesma `saveTeamAction` da configuração inicial, e a pessoa já entra nela.
export function CreateTeamPanel({ open, onClose, owner }: CreateTeamPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState<OrganizationIndustry | undefined>(undefined);
  const [logo, setLogo] = useState<Picked>(empty);
  const [banner, setBanner] = useState<Picked>(empty);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [saving, setSaving] = useState(false);

  const filled = name.trim().length >= 2 && Boolean(industry);
  const canAddGuest = emailPattern.test(guestEmail.trim()) && guestName.trim().length >= 2;

  // Revogar em limpeza de efeito quebraria no modo estrito, que desmonta e remonta: o endereço seria
  // descartado com a imagem ainda na tela. Aqui o anterior sai quando deixa de ser usado.
  const choose = (current: Picked, apply: (next: Picked) => void) => (file: File) => {
    if (current.preview?.startsWith("blob:")) URL.revokeObjectURL(current.preview);
    apply({ file, preview: URL.createObjectURL(file) });
  };

  const reject = (message: string) => toast({ title: "Arquivo recusado", description: message, tone: "danger" });

  const addGuest = () => {
    if (!canAddGuest) return;
    const email = guestEmail.trim().toLowerCase();
    setGuests((current) => [
      ...current.filter((guest) => guest.email !== email),
      { id: crypto.randomUUID(), email, name: guestName.trim(), role: "member" },
    ]);
    setGuestEmail("");
    setGuestName("");
  };

  const sendImage = async (organizationId: string, picked: Picked, kind: ImageKind) => {
    if (!picked.file) return;
    const result = await uploadTeamImage(organizationId, picked.file, kind);
    if (!result.ok) toast({ title: "A imagem não subiu", description: result.error, tone: "warning" });
  };

  const sendInvites = async (organizationId: string) => {
    for (const guest of guests) {
      const result = await inviteMemberAction({
        organizationId,
        email: guest.email,
        name: guest.name,
        role: guest.role,
      });
      if (!result.ok) {
        toast({ title: `Convite para ${guest.email} falhou`, description: result.error, tone: "warning" });
      }
    }
  };

  const reset = () => {
    setName("");
    setWebsite("");
    setIndustry(undefined);
    setLogo(empty);
    setBanner(empty);
    setGuests([]);
    setGuestEmail("");
    setGuestName("");
  };

  const close = () => {
    if (saving) return;
    onClose();
  };

  const create = async () => {
    if (saving || !industry) return;
    setSaving(true);

    const result = await saveTeamAction({ name, industry, website });
    if (!result.ok) {
      toast({ title: "Não foi possível criar a equipe", description: result.error, tone: "danger" });
      setSaving(false);
      return;
    }

    const team = result.data;

    // Imagem e convite não seguram a gaveta: a equipe já existe e cada envio custa uma ida ao servidor,
    // em série, porque o Next despacha uma Server Action por vez. Falha avisa por toast.
    void Promise.all([sendImage(team.id, logo, "logo"), sendImage(team.id, banner, "banner")])
      .then(() => sendInvites(team.id))
      .catch(() => null);

    const entered = await switchTeamAction({ organizationId: team.id });
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

  return (
    // Sem o fundo que escurece, e não por descuido: o vidro borra o que está atrás dele, e com o
    // escurecimento ligado quem seria borrado é o próprio escurecimento, deixando a gaveta cinza no
    // tema claro em vez de translúcida. Fechar por toque fora entra no lugar do clique no fundo.
    <Drawer
      open={open}
      onClose={close}
      label="Criar equipe"
      size="md"
      placement="end"
      surface="glass"
      scrim={false}
    >
      <Header>
        <Text as="h2" variant="headline" weight="semibold">
          Criar equipe
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
            preview={banner.preview}
            disabled={saving}
            onSelect={choose(banner, setBanner)}
            onReject={reject}
          />
          <ImagePicker
            variant="logo"
            label="a logo da equipe"
            hint="512 × 512"
            preview={logo.preview}
            disabled={saving}
            onSelect={choose(logo, setLogo)}
            onReject={reject}
          />
        </Identity>

        <Fields>
          <Field label="Nome da equipe">
            <Input
              type="text"
              name="name"
              value={name}
              placeholder="Como a equipe se chama"
              autoComplete="organization"
              required
              disabled={saving}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Pair>
            <Field label="Site">
              <Input
                type="text"
                name="website"
                value={website}
                placeholder="seusite.com.br"
                autoComplete="url"
                inputMode="url"
                spellCheck={false}
                disabled={saving}
                iconStart={<FieldAffix data-tone="muted">https://</FieldAffix>}
                onChange={(event) => setWebsite(event.target.value.replace(/^https?:\/\//i, ""))}
              />
            </Field>

            <Field label="Área de atuação">
              <Select
                label="Área de atuação"
                options={industryOptions}
                value={industry}
                placeholder="Escolha a área"
                disabled={saving}
                onChange={setIndustry}
              />
            </Field>
          </Pair>
        </Fields>

        <Divider />

        <Section aria-label="Pessoas da equipe">
          <Text as="h3" variant="subheadline" weight="semibold">
            Membros
          </Text>

          <Pair>
            <Field label="E-mail">
              <Input
                type="email"
                name="guest-email"
                value={guestEmail}
                placeholder="pessoa@dominio.com"
                autoComplete="off"
                inputMode="email"
                disabled={saving}
                onChange={(event) => setGuestEmail(event.target.value)}
              />
            </Field>

            <Field label="Nome">
              <Input
                type="text"
                name="guest-name"
                value={guestName}
                placeholder="Nome da pessoa"
                autoComplete="off"
                disabled={saving}
                onChange={(event) => setGuestName(event.target.value)}
              />
            </Field>
          </Pair>

          <Button
            variant="secondary"
            size="md"
            fullWidth
            disabled={!canAddGuest || saving}
            iconStart={<PlusIcon />}
            onClick={addGuest}
          >
            Convidar
          </Button>

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

            {guests.map((guest) => (
              <Person key={guest.id}>
                <Avatar name={guest.name} seed={guest.email} size="md" />
                <PersonText>
                  <Text variant="subheadline" weight="medium" truncate>
                    {guest.name}
                  </Text>
                  <Text variant="footnote" tone="secondary" truncate>
                    {guest.email}
                  </Text>
                </PersonText>
                <PersonRole>
                  <Select
                    label={`Papel de ${guest.name}`}
                    options={invitableRoleOptions}
                    value={guest.role}
                    size="sm"
                    disabled={saving}
                    onChange={(role) =>
                      setGuests((current) => current.map((item) => (item.id === guest.id ? { ...item, role } : item)))
                    }
                    actions={[
                      {
                        label: "Tirar da lista",
                        tone: "danger",
                        icon: <TrashIcon weight="bold" aria-hidden="true" />,
                        onSelect: () => setGuests((current) => current.filter((item) => item.id !== guest.id)),
                      },
                    ]}
                  />
                </PersonRole>
              </Person>
            ))}
          </People>
        </Section>
      </Scroll>

      <Footer>
        <Button variant="ghost" size="md" disabled={saving} onClick={close}>
          Cancelar
        </Button>
        <Button size="md" loading={saving} disabled={!filled} onClick={() => void create()}>
          {saving ? "Criando" : "Criar equipe"}
        </Button>
      </Footer>
    </Drawer>
  );
}
