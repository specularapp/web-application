/**
 * Atributo que marca a coluna que rola de verdade na concha da aplicação, para as camadas saberem o que
 * travar ao abrir.
 *
 * Mora aqui, e não junto do `useScrollLock`, porque a concha é Server Component e o hook é de cliente:
 * constante importada de um módulo `"use client"` chega ao servidor como referência de cliente, e não
 * como o texto, então o atributo simplesmente não saía no HTML.
 */
export const SCROLL_CONTAINER = "data-scroll-container";
