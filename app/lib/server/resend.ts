import "server-only";

import { Resend } from "resend";

let resendClient: Resend | null = null;

export function isResendConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.RESEND_FROM_EMAIL?.trim(),
  );
}

export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY não está configurada.");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

export function getResendFromEmail(): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

  if (!fromEmail) {
    throw new Error("RESEND_FROM_EMAIL não está configurado.");
  }

  return fromEmail;
}