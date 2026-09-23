"use client";

import { ArrowSquareOutIcon, CheckCircleIcon, ImageIcon, XCircleIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StoredImage } from "@/components/ui/stored-image";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action";
import { submitPublicApprovalAction } from "../actions";
import { approvalDecisions, approvalStatuses } from "../labels";
import type { ApprovalDecisionType, PublicApproval } from "../summary";
import styles from "./public-approval.module.css";

export function PublicApprovalView({ data, token }: { data: PublicApproval; token: string }) {
  const latest = data.versions[0] ?? null;
  const [versionId, setVersionId] = useState(latest?.id);
  const [decision, setDecision] = useState<ApprovalDecisionType | null>(null);
  const [feedback, setFeedback] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const version = useMemo(() => data.versions.find((item) => item.id === versionId) ?? latest, [data.versions, latest, versionId]);
  const canDecide = version?.id === latest?.id && !version?.decision && !sent;

  const submit = async () => {
    if (!version || !decision) return;
    setPending(true); setError("");
    const result = await callAction(submitPublicApprovalAction(token, { versionId: version.id, decision, feedback, respondentName: name }));
    setPending(false);
    if (!result.ok) { setError(result.error); return; }
    setSent(true);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}><strong>{data.organization.name}</strong><span>{data.approval.reference}</span></header>
      <section className={styles.shell} aria-labelledby="approval-title">
        <div className={styles.titleRow}>
          <div><span>{data.project.name} {data.project.reference}</span><h1 id="approval-title">{data.approval.title}</h1><p>{data.approval.description}</p></div>
          <Badge tone={approvalStatuses[data.approval.status].tone}>{approvalStatuses[data.approval.status].label}</Badge>
        </div>

        {!version ? <div className={styles.empty}><h2>A entrega ainda está sendo preparada</h2><p>Volte a este link quando a equipe avisar que a primeira versão está pronta.</p></div> : (
          <>
            <div className={styles.versionBar}>
              <div><strong>Versão {version.number}</strong><span>{version.title}</span></div>
              {data.versions.length > 1 && <Select label="Versão" size="sm" value={version.id} onChange={setVersionId} options={data.versions.map((item) => ({ value: item.id, label: `Versão ${item.number}` }))} />}
            </div>
            {version.notes && <p className={styles.notes}>{version.notes}</p>}
            <div className={styles.preview}>
              {version.sourceType === "url" && version.previewUrl ? (
                <><iframe title={`Prévia da versão ${version.number}`} src={version.previewUrl} sandbox="allow-forms allow-popups allow-same-origin allow-scripts" referrerPolicy="no-referrer" /><Button href={version.previewUrl} target="_blank" rel="noreferrer" variant="outline" size="sm" iconStart={<ArrowSquareOutIcon />}>Abrir em nova aba</Button></>
              ) : (
                <div className={styles.gallery}>{version.assets.map((asset) => <figure key={asset.id}><span><StoredImage src={asset.url} alt={asset.name} fill sizes="(min-width: 64rem) 48rem, 100vw" /></span><figcaption>{asset.name}</figcaption></figure>)}</div>
              )}
            </div>

            {sent ? <div className={styles.received}><CheckCircleIcon weight="fill" /><div><h2>Decisão registrada</h2><p>A equipe recebeu sua resposta sobre esta versão.</p></div></div> : version.decision ? (
              <div className={styles.received}>{version.decision.type === "approved" ? <CheckCircleIcon weight="fill" /> : <XCircleIcon weight="fill" />}<div><h2>{approvalDecisions[version.decision.type]}</h2>{version.decision.feedback && <p>{version.decision.feedback}</p>}</div></div>
            ) : canDecide ? (
              <section className={styles.decision} aria-labelledby="decision-title">
                <div><span>Decisão da versão {version.number}</span><h2 id="decision-title">O material está aprovado?</h2></div>
                <div className={styles.decisionButtons}>
                  <Button variant={decision === "approved" ? "primary" : "outline"} iconStart={<CheckCircleIcon />} onClick={() => { setDecision("approved"); setError(""); }}>Aprovar</Button>
                  <Button variant={decision === "changes_requested" ? "primary" : "outline"} iconStart={<ImageIcon />} onClick={() => { setDecision("changes_requested"); setError(""); }}>Solicitar alterações</Button>
                  <Button variant={decision === "rejected" ? "danger" : "outline"} iconStart={<XCircleIcon />} onClick={() => { setDecision("rejected"); setError(""); }}>Rejeitar</Button>
                </div>
                {decision && <div className={styles.form}>
                  <Field label={decision === "approved" ? "Comentário opcional" : "O que precisa ser alterado?"} required={decision !== "approved"}><Textarea value={feedback} maxLength={3000} onChange={(event) => setFeedback(event.target.value)} /></Field>
                  <Field label="Seu nome"><Input value={name} maxLength={80} autoComplete="name" onChange={(event) => setName(event.target.value)} /></Field>
                  {error && <p className={styles.error} role="alert">{error}</p>}
                  <Button loading={pending} onClick={() => void submit()}>Confirmar decisão</Button>
                </div>}
              </section>
            ) : null}
          </>
        )}
      </section>
      <footer>Ambiente seguro de aprovação para {data.organization.name}</footer>
    </main>
  );
}
