"use client";

import { MicrophoneIcon, PauseIcon, PlayIcon, StopIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import type { TaskAudio } from "../summary";
import styles from "./chat-audio.module.css";

/** "1:07", como todo tocador de áudio escreve tempo. */
export function clock(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/* Quantas barras a onda tem, e a altura de cada uma: o desenho é determinístico pelo endereço do áudio, para
   a mesma gravação ter sempre a mesma onda, em vez de mudar a cada redesenho. */
const BARS = 32;

function waveOf(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  return Array.from({ length: BARS }, (_, index) => {
    hash = (hash * 1103515245 + 12345) % 2147483648;
    /* Entre 28% e 100%, com as pontas mais baixas, que é como uma fala se desenha. */
    const edge = Math.min(index, BARS - 1 - index) / (BARS / 2);
    return 0.28 + (hash / 2147483648) * 0.72 * (0.45 + edge);
  });
}

/**
 * Um áudio da conversa: o botão de tocar, a onda que marca onde a fala está e o tempo. O `audio` é o
 * elemento nativo, escondido, porque o desenho dos controles dele não é da casa; o que aparece é nosso.
 *
 * A onda é desenhada, e não medida do arquivo: medir exigiria decodificar o áudio inteiro no navegador, e o
 * que a onda precisa dizer é só "aqui tem fala e ela está neste ponto".
 */
export function AudioBubble({ audio }: { audio: TaskAudio }) {
  const player = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const bars = waveOf(audio.url);
  const total = audio.seconds || 1;
  const done = Math.min(1, at / total);

  const toggle = () => {
    const element = player.current;
    if (!element) return;
    if (element.paused) void element.play();
    else element.pause();
  };

  /* Tocar num ponto da onda pula para lá: é o que se espera de qualquer barra de áudio. */
  const seek = (event: React.MouseEvent<HTMLButtonElement>) => {
    const element = player.current;
    if (!element) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    element.currentTime = ratio * total;
    setAt(element.currentTime);
  };

  return (
    <span className={styles.audio}>
      <IconButton label={playing ? "Pausar o áudio" : "Tocar o áudio"} variant="ghost" size="sm" onClick={toggle}>
        {playing ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}
      </IconButton>

      <button type="button" className={styles.wave} aria-label="Pular para um ponto do áudio" onClick={seek}>
        {bars.map((height, index) => (
          <span
            key={index}
            className={styles.bar}
            data-on={index / BARS <= done || undefined}
            style={{ height: `${Math.round(height * 100)}%` }}
          />
        ))}
      </button>

      <Text as="span" variant="caption2" className={styles.clock}>
        {clock(playing || at > 0 ? total - at : total)}
      </Text>

      {/* Sem faixa de legenda: é um áudio gravado na conversa, e não há transcrição para pôr nela. Quando o
          domínio nascer no banco e a transcrição existir, ela entra aqui como `<track>`. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={player}
        src={audio.url}
        preload="metadata"
        className={styles.element}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setAt(0);
        }}
        onTimeUpdate={(event) => setAt(event.currentTarget.currentTime)}
      />
    </span>
  );
}

export type VoiceButtonProps = {
  /** O que fazer com a gravação que terminou. */
  onRecorded: (audio: TaskAudio) => void;
};

/**
 * Gravar um áudio na conversa (2026-09-10, a pedido): o microfone começa, e o mesmo botão, agora em vermelho
 * e com o tempo correndo ao lado, encerra. O arquivo é um `blob:` feito na hora pelo `MediaRecorder`, então
 * ele toca e baixa de verdade nesta sessão; **o que falta é o armazenamento**, como no anexo da ficha.
 *
 * A permissão do microfone é pedida no clique, que é o gesto que o navegador exige, e negada vira aviso em
 * vez de silêncio.
 */
/**
 * A gravação em si, fora do botão (2026-09-11): o mesmo microfone é acionado de dois lugares, do cartão do
 * comentário no desktop e da barra flutuante no celular, e com o estado preso dentro do botão o segundo não
 * tinha como saber que já havia uma gravação em curso. O botão passou a ser só o desenho disto.
 */
export function useVoiceRecorder(onRecorded: (audio: TaskAudio) => void) {
  const { toast } = useToast();
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  /* O relógio da gravação, para quem está falando saber quanto já falou. */
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  /* Saindo da tela no meio de uma gravação, o microfone é solto: sem isto a luz do aparelho fica acesa. */
  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ title: "Sem microfone", description: "Este navegador não deixa gravar áudio", tone: "warning" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      chunks.current = [];
      media.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
        const length = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        onRecorded({ url: URL.createObjectURL(blob), seconds: length });
      };
      started.current = Date.now();
      setSeconds(0);
      media.start();
      recorder.current = media;
      setRecording(true);
    } catch {
      toast({ title: "Microfone bloqueado", description: "Libere o microfone para este site e tente de novo", tone: "warning" });
    }
  };

  const stop = () => {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  };

  return { recording, seconds, start, stop };
}

export function VoiceButton({ onRecorded }: VoiceButtonProps) {
  const { recording, seconds, start, stop } = useVoiceRecorder(onRecorded);

  if (!recording) {
    return (
      <IconButton label="Gravar áudio" variant="ghost" size="sm" onClick={() => void start()}>
        <MicrophoneIcon />
      </IconButton>
    );
  }

  return (
    <span className={styles.recording} {...squircle("sm")}>
      <span className={styles.pulse} aria-hidden="true" />
      <Text as="span" variant="caption2" weight="medium" className={styles.clock}>
        {clock(seconds)}
      </Text>
      <IconButton label="Encerrar a gravação" variant="ghost" size="sm" onClick={stop}>
        <StopIcon weight="fill" />
      </IconButton>
    </span>
  );
}
