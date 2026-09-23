"use client";

import { ArrowLeftIcon, CheckCircleIcon, CopySimpleIcon, ImageIcon, LinkIcon, PlusIcon, XCircleIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StoredImage } from "@/components/ui/stored-image";
import { Textarea } from "@/components/ui/textarea";
import type { AiUsage } from "@/features/ai/summary";
import { callAction } from "@/lib/action";
import { createApprovalVersionAction } from "../actions";
import { approvalDecisions, approvalStatuses } from "../labels";
import { approvalUrl } from "../share";
import type { ApprovalRequest, ApprovalSourceType } from "../summary";
import { uploadApprovalImages } from "../upload";
import styles from "./approvals.module.css";

export function ApprovalDetailScreen({ approval, ai }: { approval: ApprovalRequest; ai: AiUsage }) {
  const router = useRouter();
  const { toast } = useToast();
  const [sourceType, setSourceType] = useState<ApprovalSourceType>("url");
  const [title, setTitle] = useState(approval.versions[0]?.title ?? approval.title);
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const copy = async () => {
    if (!approval.versions.length) { setError("Adicione a primeira versão antes de compartilhar."); return; }
    const link = approvalUrl(approval.shareToken);
    try { await navigator.clipboard.writeText(link); toast({ title: "Link de aprovação copiado", description: "O cliente verá a versão mais recente.", tone: "success" }); }
    catch { toast({ title: "Link de aprovação", description: link, tone: "neutral" }); }
  };

  const createVersion = async () => {
    if (sourceType === "images" && files.length === 0) { setError("Escolha ao menos uma imagem."); return; }
    setPending(true);
    setError("");
    const result = await callAction(createApprovalVersionAction({ approvalId: approval.id, title, notes, sourceType, previewUrl: sourceType === "url" ? url : "" }));
    if (!result.ok) { setPending(false); setError(result.error); return; }
    if (sourceType === "images") {
      const uploaded = await uploadApprovalImages(result.id, files);
      if (!uploaded.ok) { setPending(false); setError(uploaded.error); return; }
    }
    setPending(false);
    setNotes(""); setUrl(""); setFiles([]);
    toast({ title: `Versão ${result.number} criada`, description: "A entrega já está disponível no link do cliente.", tone: "success" });
    router.refresh();
  };

  return (
    <div className={styles.screen}>
      <Topbar ai={ai} />
      <div className={styles.detail}>
        <div className={styles.detailHead}>
          <div><Button href={"/aprovacoes" as Route} variant="ghost" size="sm" iconStart={<ArrowLeftIcon />}>Aprovações</Button><h2>{approval.title}</h2><p>{approval.project.name} {approval.reference}</p></div>
          <div className={styles.headActions}><Badge tone={approvalStatuses[approval.status].tone}>{approvalStatuses[approval.status].label}</Badge><Button size="sm" iconStart={<CopySimpleIcon />} onClick={() => void copy()}>Copiar link</Button></div>
        </div>

        <div className={styles.detailGrid}>
          <Card title="Nova versão" icon={<PlusIcon />}>
            <div className={styles.versionForm}>
              <Field label="Origem"><Select label="Origem" value={sourceType} onChange={setSourceType} options={[{ value: "url", label: "URL do site ou protótipo" }, { value: "images", label: "Imagens anexadas" }]} /></Field>
              <Field label="Título da versão" required><Input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /></Field>
              <Field label="Notas da entrega"><Textarea value={notes} maxLength={2000} placeholder="O que mudou nesta versão" onChange={(event) => setNotes(event.target.value)} /></Field>
              {sourceType === "url" ? <Field label="URL" required><Input type="url" value={url} maxLength={800} placeholder="https://" iconStart={<LinkIcon />} onChange={(event) => setUrl(event.target.value)} /></Field> : <Field label="Imagens" required><Input type="file" accept="image/png,image/jpeg,image/webp,image/avif" multiple iconStart={<ImageIcon />} onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></Field>}
              {files.length > 0 && <p className={styles.fileCount}>{files.length} {files.length === 1 ? "imagem selecionada" : "imagens selecionadas"}</p>}
              {error && <p className={styles.error} role="alert">{error}</p>}
              <Button loading={pending} onClick={() => void createVersion()}>Criar versão</Button>
            </div>
          </Card>

          <section className={styles.history} aria-labelledby="versions-title">
            <h2 id="versions-title">Histórico de versões</h2>
            {approval.versions.length === 0 ? <p className={styles.muted}>Nenhuma versão enviada.</p> : approval.versions.map((version) => (
              <Card key={version.id} as="article" heading="h3" title={`Versão ${version.number} ${version.title}`} icon={version.sourceType === "url" ? <LinkIcon /> : <ImageIcon />} action={version.decision ? <Badge tone={approvalStatuses[version.decision.type].tone} size="sm">{approvalDecisions[version.decision.type]}</Badge> : <Badge tone="warning" size="sm">Aguardando</Badge>}>
                <div className={styles.versionBody}>
                  {version.notes && <p>{version.notes}</p>}
                  {version.sourceType === "url" && version.previewUrl && <a href={version.previewUrl} target="_blank" rel="noreferrer">{version.previewUrl}</a>}
                  {version.assets.length > 0 && <div className={styles.thumbs}>{version.assets.map((asset) => <span key={asset.id}><StoredImage src={asset.url} alt={asset.name} fill sizes="10rem" /></span>)}</div>}
                  {version.decision && <div className={styles.decision}>{version.decision.type === "approved" ? <CheckCircleIcon /> : <XCircleIcon />}<div><strong>{approvalDecisions[version.decision.type]}</strong>{version.decision.feedback && <p>{version.decision.feedback}</p>}</div></div>}
                </div>
              </Card>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
