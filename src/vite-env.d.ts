/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_MODE: string;
  readonly VITE_EXTRACTOR_MODEL?: string;
  readonly VITE_SOAP_GENERATOR_MODEL?: string;
  readonly VITE_KYOSAI_GENERATOR_MODEL?: string;
  readonly VITE_HISTORY_SUMMARY_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
