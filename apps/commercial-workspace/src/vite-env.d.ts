/// <reference types="vite/client" />

/**
 * Tipos das variáveis de ambiente do Vite expostas ao cliente (prefixo VITE_).
 * As duas abaixo são do PREVIEW ESTÁTICO (ver src/app/PreviewGate.tsx); no Web Service
 * de produção não são definidas e o gate fica inerte.
 */
interface ImportMetaEnv {
  /** 'true' liga o gate de senha do preview estático. */
  readonly VITE_PREVIEW_MODE?: string;
  /** Senha única (cosmética, embutida no bundle) do preview estático. */
  readonly VITE_PREVIEW_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
