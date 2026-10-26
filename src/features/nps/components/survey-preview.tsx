"use client";

import styled from "@emotion/styled";
import { ArrowClockwiseIcon, CheckCircleIcon, LockKeyIcon, QuotesIcon, StarIcon, WhatsappLogoIcon } from "@phosphor-icons/react";
import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Textarea } from "@/components/ui/textarea";
import { fillSurveyText, groupOf } from "../labels";
import type { Answer, NpsGroup, Question, Survey } from "../types";
import styles from "./survey-preview.module.css";

const SAMPLE = { name: "Helena Prado", project: "Rebranding Atelier Prado" };
const starWords = ["Ruim", "Regular", "Bom", "Muito bom", "Excelente"];

const visibleTo = (question: Question, group: NpsGroup | null) => question.showTo.length === 0 || (group !== null && question.showTo.includes(group));

/* As peças que respondem ao toque dentro da prévia: a escala de 0 a 10, as estrelas e as alternativas. */
const ScaleButton = styled.button`
  display: grid;
  place-items: center;
  min-width: 0;
  aspect-ratio: 1;
  padding: 0;
  font-family: var(--font-body);
  font-size: var(--text-footnote);
  font-weight: var(--weight-semibold);
  color: var(--color-label);
  cursor: pointer;
  background-color: var(--color-fill-quaternary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);

  &:hover {
    background-color: var(--color-fill-tertiary);
  }

  &[aria-pressed="true"] {
    color: var(--color-on-accent);
    background-color: var(--accent);
    border-color: var(--accent);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StarButton = styled.button`
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  color: var(--color-fill);
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);

  & svg {
    width: 1.75rem;
    height: 1.75rem;
  }

  &[data-on] {
    color: var(--sys-yellow);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
`;

const OptionButton = styled.button`
  display: flex;
  gap: var(--space-2);
  align-items: center;
  width: 100%;
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-body);
  font-size: var(--text-subheadline);
  color: var(--color-label);
  text-align: start;
  cursor: pointer;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);

  &::before {
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
    content: "";
    border: 1.5px solid var(--color-label-tertiary);
    border-radius: var(--option-mark, var(--radius-full));
  }

  &[aria-pressed="true"] {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  &[aria-pressed="true"]::before {
    background-color: var(--accent);
    border-color: var(--accent);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
`;

export type SurveyPreviewScreen = "form" | NpsGroup;

/**
 * A pesquisa como o cliente vê, num aparelho desenhado: a barra de progresso na cor de destaque, a saudação,
 * as perguntas que valem para a nota escolhida e, ao enviar, o agradecimento da faixa. Responder aqui não
 * grava nada; é para quem edita sentir o caminho do cliente.
 */
export function SurveyPreview({ survey, screen, onScreen }: { survey: Survey; screen: SurveyPreviewScreen; onScreen: (screen: SurveyPreviewScreen) => void }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const npsQuestion = survey.questions.find((question) => question.kind === "nps");
  const score = npsQuestion && typeof answers[npsQuestion.id] === "number" ? (answers[npsQuestion.id] as number) : null;
  const group = score === null ? null : groupOf(score);
  const shown = survey.questions.filter((question) => question.kind === "nps" || visibleTo(question, group));
  const answered = shown.filter((question) => answers[question.id] !== undefined && answers[question.id] !== "").length;
  const progress = screen === "form" ? (shown.length > 0 ? (answered / shown.length) * 100 : 0) : 100;
  const text = (value: string) => fillSurveyText(value, SAMPLE);
  const set = (id: string, value: Answer) => setAnswers((current) => ({ ...current, [id]: value }));
  const restart = () => {
    setAnswers({});
    onScreen("form");
  };

  return (
    <div className={styles.device} style={{ "--accent": survey.accent } as CSSProperties}>
      <div className={styles.screen}>
        <div className={styles.progress} aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <header className={styles.header}>
          <span className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true" />
            Estúdio Norte
          </span>
          <IconButton label="Recomeçar a prévia" variant="ghost" size="sm" onClick={restart}>
            <ArrowClockwiseIcon />
          </IconButton>
        </header>

        {screen === "form" ? (
          <div className={styles.body}>
            <p className={styles.eyebrow}>{survey.name}</p>
            <p className={styles.intro}>{text(survey.intro) || "Sem saudação."}</p>
            {shown.length === 0 && <p className={styles.hint}>Adicione uma pergunta para ver como ela aparece.</p>}
            {shown.map((question, index) => (
              <section key={question.id} className={styles.question} aria-label={`Pergunta ${index + 1}`}>
                <p className={styles.questionTitle}>
                  {text(question.title) || "Pergunta sem enunciado"}
                  {question.required && question.kind !== "nps" && <span className={styles.required}> *</span>}
                </p>
                {question.help && <p className={styles.help}>{text(question.help)}</p>}
                {question.kind === "nps" && (
                  <>
                    <div className={styles.scale}>
                      {Array.from({ length: 11 }, (_, value) => (
                        <ScaleButton key={value} type="button" aria-pressed={answers[question.id] === value} aria-label={`Nota ${value}`} onClick={() => set(question.id, value)}>
                          {value}
                        </ScaleButton>
                      ))}
                    </div>
                    <span className={styles.scaleLegend} aria-hidden="true">
                      <span>Nada provável</span>
                      <span>Muito provável</span>
                    </span>
                  </>
                )}
                {question.kind === "stars" && (
                  <div className={styles.stars}>
                    {starWords.map((word, star) => {
                      const value = typeof answers[question.id] === "number" ? (answers[question.id] as number) : 0;
                      return (
                        <StarButton key={word} type="button" data-on={star < value || undefined} aria-pressed={value === star + 1} aria-label={`${star + 1} de 5, ${word}`} onClick={() => set(question.id, star + 1)}>
                          <StarIcon weight="fill" />
                        </StarButton>
                      );
                    })}
                    {typeof answers[question.id] === "number" && <span className={styles.starWord}>{starWords[(answers[question.id] as number) - 1]}</span>}
                  </div>
                )}
                {(question.kind === "choice" || question.kind === "multiple") && (
                  <div className={styles.options} style={question.kind === "multiple" ? ({ "--option-mark": "var(--radius-xs)" } as CSSProperties) : undefined}>
                    {question.options.map((option) => {
                      const current = answers[question.id];
                      const on = question.kind === "multiple" ? Array.isArray(current) && current.includes(option) : current === option;
                      return (
                        <OptionButton
                          key={option}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            if (question.kind === "choice") return set(question.id, option);
                            const list = Array.isArray(current) ? current : [];
                            set(question.id, on ? list.filter((item) => item !== option) : [...list, option]);
                          }}
                        >
                          {option || "Alternativa sem texto"}
                        </OptionButton>
                      );
                    })}
                  </div>
                )}
                {question.kind === "yesNo" && (
                  <div className={styles.yesNo}>
                    {[true, false].map((value) => (
                      <OptionButton key={String(value)} type="button" aria-pressed={answers[question.id] === value} onClick={() => set(question.id, value)}>
                        {value ? "Sim" : "Não"}
                      </OptionButton>
                    ))}
                  </div>
                )}
                {question.kind === "text" && <Textarea rows={3} aria-label={text(question.title)} placeholder="Escreva aqui" value={typeof answers[question.id] === "string" ? (answers[question.id] as string) : ""} onChange={(event) => set(question.id, event.target.value)} />}
              </section>
            ))}
            <Button fullWidth disabled={score === null} background="var(--accent)" foreground="var(--color-on-accent)" onClick={() => group && onScreen(group)}>
              {score === null ? "Escolha uma nota para enviar" : "Enviar resposta"}
            </Button>
          </div>
        ) : (
          <div className={styles.thanks}>
            <CheckCircleIcon weight="fill" aria-hidden="true" className={styles.thanksIcon} />
            <p className={styles.thanksTitle}>{text(survey.thanks[screen].title) || "Agradecimento sem título"}</p>
            <p className={styles.intro}>{text(survey.thanks[screen].text)}</p>
            {((screen === "promoter" && survey.testimonial) || screen === "detractor") && (
              <div className={styles.thanksActions} inert>
                {screen === "promoter" ? (
                  <Button fullWidth iconStart={<QuotesIcon />} background="var(--accent)" foreground="var(--color-on-accent)">
                    Deixar um depoimento
                  </Button>
                ) : (
                  <Button fullWidth variant="outline" iconStart={<WhatsappLogoIcon />}>
                    Falar agora pelo WhatsApp
                  </Button>
                )}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={restart}>
              Responder de novo
            </Button>
          </div>
        )}

        <footer className={styles.footer}>
          <LockKeyIcon aria-hidden="true" />
          Suas respostas vão só para a equipe do estúdio
        </footer>
      </div>
    </div>
  );
}
