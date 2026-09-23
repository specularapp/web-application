import { ArrowLeftIcon, CheckCircleIcon, PencilSimpleIcon, UsersThreeIcon } from "@phosphor-icons/react/ssr";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import { Topbar } from "@/components/layout/topbar";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { AiUsage } from "@/features/ai/summary";
import { applyPattern } from "@/lib/masks";
import type { IntakeForm, IntakeFormSubmission } from "../summary";
import styles from "./form-responses-screen.module.css";

const sentAt = (value: string) => format(parseISO(value), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
const sentAtShort = (value: string) => format(parseISO(value), "dd/MM/yyyy HH:mm", { locale: ptBR });

function answerText(question: IntakeForm["questions"][number] | undefined, answer: string | string[]) {
  if (Array.isArray(answer)) return answer.join(", ");
  if (question?.type === "phone") return applyPattern("phone", answer);
  if (question?.type === "date") return format(parseISO(answer), "dd/MM/yyyy");
  return answer;
}

export function FormResponsesScreen({ form, submissions, ai }: { form: IntakeForm; submissions: IntakeFormSubmission[]; ai: AiUsage }) {
  const questions = new Map(form.questions.map((question) => [question.id, question]));

  return (
    <div className={styles.screen}>
      <Topbar title={form.title} ai={ai} />
      <main className={styles.main}>
        <header className={styles.head}>
          <div>
            <span>{form.reference}</span>
            <h2>Respostas</h2>
            <p>{submissions.length} {submissions.length === 1 ? "envio recebido" : "envios recebidos"}</p>
          </div>
          <div className={styles.actions}>
            <Button href="/formularios" variant="ghost" size="sm" radius="md" iconStart={<ArrowLeftIcon />}>Formulários</Button>
            <Button href={`/formularios/${form.id}` as Route} variant="outline" size="sm" radius="md" iconStart={<PencilSimpleIcon />}>Editar</Button>
          </div>
        </header>

        {submissions.length === 0 ? (
          <EmptyState icon={UsersThreeIcon} title="Nenhuma resposta ainda" description="Quando alguém enviar o formulário, as respostas e o consentimento aparecerão aqui.">
            <Button href={`/formularios/${form.id}` as Route} size="sm" radius="md">Abrir formulário</Button>
          </EmptyState>
        ) : (
          <div className={styles.list}>
            {submissions.map((submission, index) => {
              const name = submission.respondentName || submission.client?.name || submission.respondentEmail || `Resposta ${submissions.length - index}`;
              const entries = Object.entries(submission.answers).filter(([questionId]) => questions.has(questionId));
              return (
                <Card
                  key={submission.id}
                  as="article"
                  title={name}
                  icon={<Avatar name={name} src={submission.client?.avatarUrl ?? undefined} size="sm" />}
                  action={<span title={sentAt(submission.createdAt)}><Badge tone="neutral" size="sm">{sentAtShort(submission.createdAt)}</Badge></span>}
                >
                  <div className={styles.contact}>
                    {submission.respondentEmail && <span>{submission.respondentEmail}</span>}
                    {submission.respondentPhone && <span>{applyPattern("phone", submission.respondentPhone)}</span>}
                  </div>
                  <dl className={styles.answers}>
                    {entries.map(([questionId, answer]) => (
                      <div key={questionId}>
                        <dt>{questions.get(questionId)?.label}</dt>
                        <dd>{answerText(questions.get(questionId), answer)}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className={styles.consent}>
                    <CheckCircleIcon weight="fill" />
                    <div><strong>Consentimento registrado</strong><span>{submission.consentText}</span><small>{sentAt(submission.consentedAt)}</small></div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
