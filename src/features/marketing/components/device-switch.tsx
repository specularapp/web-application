"use client";

import { DesktopIcon, DeviceMobileIcon } from "@phosphor-icons/react";
import { useTabList } from "@/hooks/use-tab-list";
import styles from "./device-switch.module.css";

export type PreviewDevice = "desktop" | "mobile";

const devices: readonly PreviewDevice[] = ["desktop", "mobile"];

const labels: Record<PreviewDevice, string> = { desktop: "Computador", mobile: "Celular" };

// A escolha entre ver o e-mail no computador ou no celular: dois glifos colados numa caixa com o fio da casa,
// com o teclado da fila de rádios da casa.
export function DeviceSwitch({ value, onChange }: { value: PreviewDevice; onChange: (device: PreviewDevice) => void }) {
  const tabs = useTabList(devices, value, onChange, { as: "radio" });

  return (
    <div className={styles.switch} aria-label="Ver a prévia no" {...tabs.listProps}>
      {devices.map((device) => {
        const Glyph = device === "desktop" ? DesktopIcon : DeviceMobileIcon;
        return (
          <button key={device} type="button" className={styles.option} {...tabs.tabProps(device)} aria-label={labels[device]} title={labels[device]} data-on={device === value || undefined} onClick={() => onChange(device)}>
            <Glyph aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
