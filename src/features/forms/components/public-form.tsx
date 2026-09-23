"use client";

import Image from "next/image";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, EnvelopeSimpleIcon, LockKeyIcon } from "@phosphor-icons/react";
import { format, isValid, parseISO } from "date-fns";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action";
import { submitPublicIntakeFormAction } from "../actions";
import type { PublicIntakeForm, PublicIntakeQuestion } from "../summary";
import styles from "./public-form.module.css";

type Answer = string | string[];
type Errors = Record<string, string>;

const empty = (value: Answer | undefined) => value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
const validWebsite = (value: string) => {
  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
};

function validateQuestion(question: PublicIntakeQuestion, value: Answer | undefined) {
  if (question.required && empty(value)) return "Esta resposta é obrigatória.";
  if (empty(value)) return null;
  if (question.type === "multiple_choice") {
    return Array.isArray(value) && value.every((entry) => question.options.includes(entry)) ? null : "Confira as opções escolhidas.";
  }
  if (Array.isArray(value)) return "Confira esta resposta.";
  const normalized = typeof value === "string" ? value.trim() : "";
  if (question.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) return "Informe um e-mail válido.";
  if (question.type === "phone" && !/^\d{10,11}$/.test(normalized.replace(/\D/g, ""))) return "Informe um telefone com DDD.";
  if (question.type === "date" && !validDate(normalized)) return "Escolha uma data válida.";
  if (question.type === "single_choice" && !question.options.includes(normalized)) return "Escolha uma opção da lista.";
  if (question.type === "short_text" && normalized.length > 160) return "Use até 160 caracteres.";
  if (question.type === "long_text" && normalized.length > 5000) return "Use até 5.000 caracteres.";
  if (question.profileField === "website" && !validWebsite(normalized)) return "Informe um endereço de site válido.";
  return null;
}

export function PublicForm({ token, data }: { token: string; data: PublicIntakeForm }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { form, project, organization, questions } = data;
  const pages = useMemo(() => {
    const grouped = new Map<number, PublicIntakeQuestion[]>();
    questions.forEach((question) => grouped.set(question.page, [...(grouped.get(question.page) ?? []), question]));
    return [...grouped.entries()].sort(([left], [right]) => left - right).map(([, entries]) => entries);
  }, [questions]);
  const page = pages[pageIndex] ?? [];
  const last = pageIndex === pages.length - 1;
  const progress = sent ? 100 : pages.length > 0 ? ((pageIndex + 1) / pages.length) * 100 : 0;

  useEffect(() => {
    contentRef.current?.focus({ preventScroll: true });
  }, [pageIndex, sent]);

  const change = (questionId: string, value: Answer) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setErrors((current) => {
      if (!current[questionId]) return current;
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  };

  const validatePage = () => {
    const next: Errors = {};
    page.forEach((question) => {
      const issue = validateQuestion(question, answers[question.id]);
      if (issue) next[question.id] = issue;
    });
    if (last && !consent) next.consent = "Confirme o uso das informações para enviar.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const nextPage = () => {
    setError(null);
    if (!validatePage()) return;
    setPageIndex((current) => Math.min(current + 1, pages.length - 1));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!last) {
      nextPage();
      return;
    }
    if (!validatePage()) return;
    setPending(true);
    const result = await callAction(submitPublicIntakeFormAction(token, { answers, consent }));
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  return (
    <main className={styles.page} style={{ "--form-hue": `var(--sys-${project.hue})` } as CSSProperties}>
      <div className={styles.progress} role="progressbar" aria-label="Progresso do formulário" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <header className={styles.header}>
        <div className={styles.organization}>
          {organization.logoUrl ? <Image src={organization.logoUrl} alt="" width={32} height={32} className={styles.logo} unoptimized /> : <span className={styles.logoFallback}>{organization.name.slice(0, 1).toUpperCase()}</span>}
          <span>{organization.name}</span>
        </div>
        <div className={styles.formIdentity}>
          <strong>{form.title}</strong>
          <span>{project.name} · {form.reference}</span>
        </div>
      </header>

      <section className={styles.stage}>
        <div ref={contentRef} className={styles.content} tabIndex={-1}>
          {sent ? (
            <div className={styles.success} role="status">
              <span className={styles.successIcon}><CheckCircleIcon weight="fill" /></span>
              <h1>{form.successTitle}</h1>
              <p>{form.successMessage}</p>
              {organization.email && <Button href={`mailto:${organization.email}`} variant="outline" size="md" radius="md" iconStart={<EnvelopeSimpleIcon />}>Falar com {organization.name}</Button>}
            </div>
          ) : (
            <form ref={formRef} className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
              <h1 className={styles.formTitle}>{form.title}</h1>
              <div className={styles.intro}>
                <span>{pageIndex + 1} de {pages.length}</span>
                {pageIndex === 0 && <p>{form.description}</p>}
              </div>
              <div className={styles.questions}>
                {page.map((question, index) => (
                  <PublicQuestion
                    key={question.id}
                    question={question}
                    number={questions.findIndex((entry) => entry.id === question.id) + 1}
                    value={answers[question.id]}
                    error={errors[question.id]}
                    focus={index === 0}
                    onChange={(value) => change(question.id, value)}
                    onEnter={() => last ? formRef.current?.requestSubmit() : nextPage()}
                  />
                ))}
              </div>
              {last && (
                <div className={styles.consent} data-invalid={errors.consent || undefined}>
                  <Checkbox checked={consent} onChange={(event) => { setConsent(event.target.checked); setErrors((current) => ({ ...current, consent: "" })); }} required>{form.consentText}</Checkbox>
                  <p>O texto aceito e a data da concordância serão registrados junto das respostas.</p>
                  {errors.consent && <span role="alert">{errors.consent}</span>}
                </div>
              )}
              {error && <p className={styles.serverError} role="alert">{error}</p>}
              <div className={styles.primaryAction}>
                <Button type="submit" size="md" radius="md" loading={pending} iconEnd={!last ? <ArrowRightIcon /> : undefined}>
                  {last ? form.submitLabel : "Continuar"}
                </Button>
                <span>pressione Enter ↵</span>
              </div>
            </form>
          )}
        </div>
      </section>

      <footer className={styles.footer}>
        <span><LockKeyIcon />Suas respostas são enviadas com segurança</span>
        {!sent && (
          <div className={styles.pageActions}>
            <IconButton label="Página anterior" size="sm" variant="outline" disabled={pageIndex === 0} onClick={() => setPageIndex((current) => Math.max(0, current - 1))}><ArrowLeftIcon /></IconButton>
            <IconButton label="Próxima página" size="sm" variant="outline" disabled={last} onClick={nextPage}><ArrowRightIcon /></IconButton>
          </div>
        )}
      </footer>
    </main>
  );
}

function PublicQuestion({ question, number, value, error, focus, onChange, onEnter }: { question: PublicIntakeQuestion; number: number; value: Answer | undefined; error?: string; focus: boolean; onChange: (value: Answer) => void; onEnter: () => void }) {
  const label = <><span className={styles.number}>{number}</span>{question.label}</>;
  const textValue = typeof value === "string" ? value : "";
  const common = {
    value: textValue,
    placeholder: question.placeholder || "Digite sua resposta",
    required: question.required,
    autoFocus: focus,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };

  if (question.type === "long_text") {
    return <div className={styles.question}>{question.description && <p>{question.description}</p>}<Field label={label} required={question.required} error={error} revealError><Textarea {...common} rows={5} maxLength={5000} /></Field></div>;
  }
  if (question.type === "multiple_choice") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className={styles.choiceField} data-invalid={error || undefined}>
        <legend>{label}</legend>
        {question.description && <p>{question.description}</p>}
        <div className={styles.checkboxes}>
          {question.options.map((option) => <Checkbox key={option} checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((entry) => entry !== option))}>{option}</Checkbox>)}
        </div>
        {error && <span role="alert">{error}</span>}
      </fieldset>
    );
  }
  if (question.type === "single_choice") {
    return (
      <div className={styles.question}>
        {question.description && <p>{question.description}</p>}
        <Field label={label} required={question.required} error={error} revealError>
          <Select label={question.label} value={textValue || undefined} placeholder={question.placeholder || "Escolha uma opção"} options={question.options.map((option) => ({ value: option, label: option }))} onChange={(next) => onChange(String(next))} />
        </Field>
      </div>
    );
  }
  if (question.type === "date") {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(textValue) ? parseISO(textValue) : undefined;
    return <div className={styles.question}>{question.description && <p>{question.description}</p>}<Field label={label} required={question.required} error={error} revealError><DatePicker value={parsed} placeholder={question.placeholder || "Escolha uma data"} onChange={(date) => onChange(date ? format(date, "yyyy-MM-dd") : "")} /></Field></div>;
  }

  return (
    <div className={styles.question}>
      {question.description && <p>{question.description}</p>}
      <Field label={label} required={question.required} error={error} revealError>
        <Input
          {...common}
          type={question.type === "email" ? "email" : question.profileField === "website" ? "url" : "text"}
          inputMode={question.type === "email" ? "email" : question.profileField === "website" ? "url" : undefined}
          mask={question.type === "phone" ? "phone" : undefined}
          maxLength={160}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onEnter();
          }}
        />
      </Field>
    </div>
  );
}
