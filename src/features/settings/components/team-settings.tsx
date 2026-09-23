"use client";

import { UsersThreeIcon } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamPeoplePanel } from "@/features/organizations/components/team-people";
import type { TeamState } from "@/features/organizations/service";
import type { AiUsage } from "@/features/ai/summary";
import { SettingsPage, SettingsSection } from "./settings-page";

/**
 * A página da equipe (2026-09-17): quem está dentro, com o papel de cada um, quem foi convidado e ainda não
 * entrou, e o convite novo. É a etapa de membros dos primeiros passos vivendo como página: a mesma regra
 * (proprietário não é papel travado, o único limite é o time nunca ficar sem nenhum), sem o avançar e sem a
 * prévia. Quem é membro vê a lista e não mexe; quem administra convida, troca papel e remove.
 *
 * Os blocos saem do `TeamPeoplePanel` (2026-09-21), o mesmo que a gaveta de editar equipe abre: a página só
 * escolhe a moldura, que aqui é o cartão de ajuste.
 */
export function TeamSettings({ team, members, invites, viewer, ai }: TeamState & { ai: AiUsage }) {
  if (!team) {
    return (
      <SettingsPage ai={ai}>
        <EmptyState icon={UsersThreeIcon} title="Você ainda não está numa equipe" description="Crie a sua pelo seletor de equipe, no topo do menu." />
      </SettingsPage>
    );
  }

  return (
    <SettingsPage ai={ai}>
      {/* Uma chave por equipe, como na gaveta de editar: trocando de equipe pelo seletor a página só recebe
          props novas, sem navegar, e sem isto a lista e o campo de convite seguiriam sendo os da equipe
          anterior enquanto as ações já iriam para a nova. */}
      <TeamPeoplePanel
        key={team.id}
        organizationId={team.id}
        members={members}
        invites={invites}
        viewer={viewer}
        section={SettingsSection}
      />
    </SettingsPage>
  );
}
