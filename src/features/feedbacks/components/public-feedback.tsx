"use client";

import { CheckCircleIcon, StarIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action";
import { submitPublicFeedbackAction } from "../actions";
import type { PublicClientFeedback } from "../summary";
import styles from "./public-feedback.module.css";

export function PublicFeedback({ data, token }: { data: PublicClientFeedback; token: string }) {
  const [rating, setRating] = useState(0);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(data.feedback.status === "submitted");

  const submit = async () => {
    if (!rating) { setError("Escolha uma nota de 1 a 5."); return; }
    if (recommend === null) { setError("Informe se recomendaria nosso trabalho."); return; }
    setPending(true);
    setError("");
    const result = await callAction(submitPublicFeedbackAction(token, { rating, wouldRecommend: recommend, comment, respondentName: name }));
    setPending(false);
    if (!result.ok) { setError(result.error); return; }
    setDone(true);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <strong>{data.organization.name}</strong>
        <span>{data.project.reference}</span>
      </header>
      <section className={styles.panel} aria-labelledby="feedback-title">
        {done ? (
          <div className={styles.success}>
            <CheckCircleIcon weight="fill" />
            <h1 id="feedback-title">Avaliação recebida</h1>
            <p>Obrigado por compartilhar sua experiência com {data.organization.name}.</p>
          </div>
        ) : (
          <>
            <div className={styles.intro}>
              <span>{data.project.name}</span>
              <h1 id="feedback-title">{data.feedback.title}</h1>
              <p>{data.feedback.prompt}</p>
            </div>
            <div className={styles.form}>
              <fieldset className={styles.question}>
                <legend>Como você avalia a experiência?</legend>
                <div className={styles.stars}>
                  {Array.from({ length: 5 }, (_, index) => {
                    const value = index + 1;
                    return <button key={value} type="button" aria-label={`${value} estrelas`} aria-pressed={rating === value} onClick={() => { setRating(value); setError(""); }}><StarIcon weight={value <= rating ? "fill" : "regular"} /></button>;
                  })}
                </div>
              </fieldset>
              <fieldset className={styles.question}>
                <legend>Você recomendaria nosso trabalho?</legend>
                <div className={styles.choice}><Button variant={recommend === true ? "primary" : "outline"} onClick={() => { setRecommend(true); setError(""); }}>Sim</Button><Button variant={recommend === false ? "primary" : "outline"} onClick={() => { setRecommend(false); setError(""); }}>Não</Button></div>
              </fieldset>
              <Field label="Quer contar um pouco mais?"><Textarea value={comment} maxLength={1200} placeholder="Conte o que funcionou bem ou o que podemos melhorar" onChange={(event) => setComment(event.target.value)} /></Field>
              <Field label="Seu nome"><Input value={name} maxLength={80} autoComplete="name" placeholder="Nome completo" onChange={(event) => setName(event.target.value)} /></Field>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <Button size="lg" loading={pending} onClick={() => void submit()}>Enviar avaliação</Button>
            </div>
          </>
        )}
      </section>
      <footer>Feedback seguro para {data.organization.name}</footer>
    </main>
  );
}
