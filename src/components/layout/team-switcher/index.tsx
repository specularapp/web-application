"use client";

import styled from "@emotion/styled";
import { CaretUpDownIcon, CheckIcon, MagnifyingGlassIcon, PlusIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { hoverMotion, layerMotion } from "@/components/ui/styles";
import { Text } from "@/components/ui/text";
import { planBadges } from "@/features/billing/plans";
import { switchTeamAction } from "@/features/organizations/actions";
import { CREATE_TEAM_PLAN, CreateTeamPanel, type TeamOwner } from "@/features/organizations/components/create-team-panel";
import { slugify } from "@/features/organizations/schemas";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
import { usePresence } from "@/hooks/use-presence";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";

/** O plano chega como rótulo pronto: quem traduz o código do banco é o painel que monta o menu. */
export type SwitcherTeam = { id: string; name: string; plan: string; logoUrl: string | null };

export type TeamSwitcherProps = {
  teams: SwitcherTeam[];
  currentId: string | null;
  owner: TeamOwner;
  size?: "sm" | "md";
};

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 340;
const EDGE = 16;

/* Canto declarado direto, sem `data-squircle`: a caixa guarda o anel de foco do campo de busca, e o
   recorte do fallback cortaria ele. Mesma escolha do Listbox e do Tooltip. */
const Popover = styled.div`
  --genie-y: calc(var(--space-2) * -1);
  --panel-line: 0.0375rem;

  position: fixed;
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
  width: min(${PANEL_WIDTH}px, calc(100vw - ${EDGE * 2}px));
  overflow: hidden;
  background-color: var(--glass-bg);
  border: var(--panel-line) solid var(--color-border);
  border-radius: var(--radius-lg);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  transform-origin: top left;

  ${layerMotion};

  &[data-placement="above"] {
    --genie-y: var(--space-2);
    transform-origin: bottom left;
    translate: 0 -100%;
  }
`;

const Search = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
  padding-inline: var(--space-3);
  border-block-end: var(--panel-line, 0.0375rem) solid var(--color-border);

  & > svg {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    color: var(--color-label-secondary);
  }
`;

/* Fonte de 16px no celular por baixo, senão o Safari dá zoom ao focar o campo e a caixa sai do lugar. */
const Field = styled.input`
  flex: 1;
  min-width: 0;
  min-height: var(--touch-target);
  padding: 0;
  font-family: var(--font-body);
  font-size: max(16px, var(--text-subheadline));
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  background-color: transparent;
  border: 0;
  outline: none;

  &::placeholder {
    color: var(--color-placeholder);
  }
`;

/* A faixa dos times tem altura reservada: com um time só a caixa ficaria espremida entre a busca e o
   rodapé, e com muitos ela empurraria o convite de criar para fora da vista. */
const Body = styled.div`
  display: grid;
  align-content: start;
  min-height: 10rem;
  max-height: 15rem;
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;

  &[data-empty] {
    align-content: center;
  }

  &[data-mode="sheet"] {
    max-height: 22rem;
  }
`;

const List = styled.ul`
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: var(--space-2);
  list-style: none;
`;

/* O item é linha de lista, e não botão, porque quem guarda o foco é o campo de busca: a seta move o
   ativo e o leitor de tela acompanha por `aria-activedescendant`. */
const Option = styled.li`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  padding-inline: var(--space-2);
  font-size: var(--text-subheadline);
  letter-spacing: var(--tracking-tight);
  color: var(--color-label);
  border-radius: var(--radius-md);
  corner-shape: squircle;
  cursor: pointer;

  ${hoverMotion};

  &[data-active] {
    background-color: var(--color-fill-quaternary);
  }

  &[aria-selected="true"] {
    font-weight: var(--weight-medium);
    background-color: var(--color-fill-tertiary);
  }

  &[data-busy] {
    cursor: progress;
  }
`;

const Name = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Mark = styled.span`
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 1.125rem;
  height: 1.125rem;
  color: var(--color-label);

  & svg {
    width: 1.125rem;
    height: 1.125rem;
  }
`;

const Empty = styled.div`
  display: grid;
  gap: var(--space-3);
  place-items: center;
  padding: var(--space-6);
  text-align: center;
`;

const EmptyIcon = styled.span`
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--color-label-secondary);
  border: var(--panel-line, 0.0375rem) solid var(--color-border);
  border-radius: var(--radius-md);
  corner-shape: squircle;

  & svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;

const Footer = styled.div`
  flex-shrink: 0;
  padding: var(--space-2);
  border-block-start: var(--panel-line, 0.0375rem) solid var(--color-border);
`;

/* O botão não encosta na borda do rodapé: o recuo é o mesmo da lista, então o hover pinta uma caixa
   arredondada por dentro, no ritmo das opções de cima, em vez de uma faixa de ponta a ponta. */
const Create = styled.button`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: var(--touch-target);
  padding: var(--space-2);
  font-family: var(--font-body);
  text-align: start;
  background-color: transparent;
  border: 0;
  border-radius: var(--radius-md);
  corner-shape: squircle;
  cursor: pointer;

  ${hoverMotion};

  &:hover:not(:disabled) {
    background-color: var(--color-fill-quaternary);
  }

  &:disabled {
    cursor: not-allowed;
  }

  & > svg {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    color: var(--color-label-secondary);
  }
`;

const CreateText = styled.span`
  display: grid;
  flex: 1;
  gap: var(--space-half);
  min-width: 0;
`;

/* A etiqueta do plano anda com o rótulo, e não na outra ponta da linha: ela qualifica o "Criar
   equipe", do mesmo jeito que o "Pendente" anda com o nome na lista de pessoas. */
const CreateTitle = styled.span`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
`;

function matches(name: string, query: string) {
  return slugify(name, 80).includes(slugify(query, 80));
}

// Troca de time: no desktop a caixa nasce colada no próprio seletor, sem escurecer a tela, e no
// celular vira bandeja no rodapé, onde o topo do painel fica longe do polegar. Quem valida o destino
// é `set_current_org` no banco, então o aplicativo troca pela mesma porta.
export function TeamSwitcher({ teams, currentId, owner, size = "sm" }: TeamSwitcherProps) {
  const router = useRouter();
  const { toast } = useToast();
  const sheet = useMediaQuery(MOBILE_QUERY);
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [switching, setSwitching] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { present, state, onAnimationEnd } = usePresence(open && !sheet);

  const filtered = useMemo(
    () => (query.trim() ? teams.filter((team) => matches(team.name, query)) : teams),
    [teams, query],
  );

  const position = useAnchoredPosition(open && !sheet, triggerRef, { width: PANEL_WIDTH, height: PANEL_HEIGHT });

  // Só o desktop abre com o cursor na busca: no celular focar o campo faz o teclado subir sozinho e
  // comer metade da bandeja antes de a pessoa ver a lista.
  useEffect(() => {
    if (!open || sheet) return;
    const frame = window.requestAnimationFrame(() => fieldRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [open, sheet]);

  useEffect(() => {
    if (!open) return;
    bodyRef.current?.querySelector<HTMLElement>("[data-active]")?.scrollIntoView({ block: "nearest" });
  }, [open, active, query]);

  // A bandeja fecha por Escape e por toque fora dentro do próprio Dialog; no desktop a caixa é avulsa
  // e precisa dos dois escutadores aqui.
  useEffect(() => {
    if (!open || sheet) return;

    const dismiss = () => {
      if (switching) return;
      setOpen(false);
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      dismiss();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      dismiss();
      triggerRef.current?.focus({ preventScroll: true });
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, sheet, switching]);

  const close = () => {
    if (switching) return;
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const choose = async (team: SwitcherTeam) => {
    if (switching) return;

    if (team.id === currentId) {
      close();
      return;
    }

    setSwitching(team.id);
    const result = await switchTeamAction({ organizationId: team.id });
    setSwitching(null);

    if (!result.ok) {
      toast({ title: "Não foi possível trocar de time", description: result.error, tone: "danger" });
      return;
    }

    setOpen(false);
    router.refresh();
  };

  const navigate = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (filtered.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + filtered.length) % filtered.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const team = filtered[active];
      if (team) void choose(team);
    }
  };

  const content = (
    <>
      <Search>
        <MagnifyingGlassIcon aria-hidden="true" />
        <Field
          ref={fieldRef}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-label="Buscar equipe"
          aria-expanded={filtered.length > 0}
          aria-controls={filtered.length > 0 ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].id}` : undefined}
          placeholder="Buscar equipe"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={navigate}
        />
        <Kbd aria-hidden="true">Esc</Kbd>
      </Search>

      <Body ref={bodyRef} data-mode={sheet ? "sheet" : "popover"} data-empty={filtered.length === 0 || undefined}>
        {filtered.length > 0 ? (
          <List id={listId} role="listbox" aria-label="Equipes">
            {filtered.map((team, index) => (
              <Option
                key={team.id}
                id={`${listId}-${team.id}`}
                role="option"
                aria-selected={team.id === currentId}
                data-active={index === active || undefined}
                data-busy={switching === team.id || undefined}
                onPointerMove={() => setActive(index)}
                onClick={() => void choose(team)}
              >
                <Avatar name={team.name} src={team.logoUrl ?? undefined} size="xs" shape="squircle" />
                <Name>{team.name}</Name>
                <Badge tone="neutral" variant="soft" size="sm">
                  {team.plan}
                </Badge>
                <Mark>
                  {switching === team.id ? (
                    <Spinner size="sm" label="Trocando de time" />
                  ) : (
                    team.id === currentId && <CheckIcon aria-hidden="true" />
                  )}
                </Mark>
              </Option>
            ))}
          </List>
        ) : (
          <Empty>
            <EmptyIcon aria-hidden="true">
              <UsersThreeIcon />
            </EmptyIcon>
            <Text variant="footnote" tone="secondary">
              {teams.length === 0
                ? "Os times que você criar ou aceitar aparecem aqui para trocar de contexto."
                : "Nenhuma equipe com esse nome."}
            </Text>
          </Empty>
        )}
      </Body>

      <Footer>
        <Create
          type="button"
          onClick={() => {
            setOpen(false);
            setCreating(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          <CreateText>
            <CreateTitle>
              <Text variant="subheadline" weight="medium">
                Criar equipe
              </Text>
              <Badge tone="neutral" variant="soft" size="sm">
                {planBadges[CREATE_TEAM_PLAN]}
              </Badge>
            </CreateTitle>
            <Text variant="caption1" tone="secondary">
              Trabalhe junto com outras pessoas num espaço novo
            </Text>
          </CreateText>
        </Create>
      </Footer>
    </>
  );

  return (
    <>
      <IconButton
        ref={triggerRef}
        label="Trocar de time"
        variant="ghost"
        size={size}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setQuery("");
          setActive(0);
          setOpen((current) => !current);
        }}
      >
        <CaretUpDownIcon />
      </IconButton>

      {sheet ? (
        <Dialog
          open={open}
          onClose={close}
          label="Trocar de time"
          size="sm"
          surface="glass"
          scrim={false}
          focusOnOpen={false}
        >
          {content}
        </Dialog>
      ) : (
        present &&
        createPortal(
          <Popover
            ref={popoverRef}
            role="dialog"
            aria-label="Trocar de time"
            data-placement={position?.placement ?? "below"}
            data-state={state}
            style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
            onAnimationEnd={onAnimationEnd}
          >
            {content}
          </Popover>,
          document.body,
        )
      )}

      <CreateTeamPanel open={creating} owner={owner} onClose={() => setCreating(false)} />
    </>
  );
}
