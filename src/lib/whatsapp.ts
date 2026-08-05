import type { SiteLocale } from "./locale";

/*
  WHATSAPP CTA — single source of truth for the wa.me link and its
  surrounding copy (Task 4.5), shared by every ContactForm instance via
  its `locale` prop. Centralized here instead of copy-pasted across the
  ~27 pages that render ContactForm — see ContactForm.astro's PROPS
  comment.

  MESSAGE TEXT: fixed per locale, deliberately unfinished (the visitor
  completes the sentence in WhatsApp) — never customize per page, and
  never hand-paste percent-encoding; `whatsappHref()` encodes at build
  time via `encodeURIComponent`.
*/
const WHATSAPP_NUMBER = "972537125488";

const WHATSAPP_MESSAGE: Record<SiteLocale, string> = {
  en: "Hi Eyal, I have a business and currently we",
  he: "היי אייל, יש לי עסק וכיום אנחנו",
};

export function whatsappHref(locale: SiteLocale): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE[locale])}`;
}

export interface WhatsAppCopy {
  /** Small muted label on the divider between the form and the WhatsApp button (e.g. "or" / "או"). */
  dividerText: string;
  /** Button label below the form, before submit. */
  formLabel: string;
  /** Button label inside the post-submit success state — "speed things up" framing. */
  successLabel: string;
}

export const whatsappCopy: Record<SiteLocale, WhatsAppCopy> = {
  en: {
    dividerText:  "or",
    formLabel:    "Prefer WhatsApp? Message us directly",
    successLabel: "Want to speed things up? WhatsApp us now",
  },
  he: {
    dividerText:  "או",
    formLabel:    "עדיף לכם וואטסאפ? כתבו לנו ישירות",
    successLabel: "רוצים לזרז? שלחו לנו וואטסאפ עכשיו",
  },
};
