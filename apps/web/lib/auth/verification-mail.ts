import { getCanonicalAppOrigin } from "./app-origin";
import {
  EMAIL_VERIFY_TTL_MS,
  issueAuthToken,
  PASSWORD_CHANGE_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from "./auth-tokens";
import { enqueueMail, processPendingMail } from "@/lib/mail/outbox";
import {
  passwordChangeConfirmEmail,
  passwordChangedNoticeEmail,
  passwordResetEmail,
  verificationEmail,
} from "@/lib/mail/templates";
import type { NextRequest } from "next/server";

export async function sendEmailVerification(params: {
  userId: string;
  email: string;
  name: string;
  generation?: number;
  request?: NextRequest;
}) {
  const { rawToken, tokenId } = await issueAuthToken({
    userId: params.userId,
    purpose: "EMAIL_VERIFY",
    pendingEmail: params.email,
    generation: params.generation,
    ttlMs: EMAIL_VERIFY_TTL_MS,
  });
  const origin = getCanonicalAppOrigin(params.request);
  const verifyUrl = `${origin}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
  const content = verificationEmail({ name: params.name, verifyUrl });
  await enqueueMail({
    toEmail: params.email,
    subject: content.subject,
    htmlBody: content.html,
    textBody: content.text,
    purpose: "email_verify",
    idempotencyKey: `email_verify:${params.userId}:${tokenId}`,
    relatedTokenId: tokenId,
    supersedePurposeForEmail: true,
  });
  void processPendingMail().catch(() => undefined);
}

export async function sendPasswordChangeConfirmation(params: {
  userId: string;
  email: string;
  name: string;
  pendingPasswordHash: string;
  request?: NextRequest;
}) {
  const { rawToken, tokenId } = await issueAuthToken({
    userId: params.userId,
    purpose: "PASSWORD_CHANGE",
    pendingPasswordHash: params.pendingPasswordHash,
    ttlMs: PASSWORD_CHANGE_TTL_MS,
  });
  const origin = getCanonicalAppOrigin(params.request);
  const confirmUrl = `${origin}/auth/confirm-password-change?token=${encodeURIComponent(rawToken)}`;
  const content = passwordChangeConfirmEmail({ name: params.name, confirmUrl });
  await enqueueMail({
    toEmail: params.email,
    subject: content.subject,
    htmlBody: content.html,
    textBody: content.text,
    purpose: "password_change",
    idempotencyKey: `password_change:${params.userId}:${tokenId}`,
    relatedTokenId: tokenId,
    supersedePurposeForEmail: true,
  });
  void processPendingMail().catch(() => undefined);
}

export async function sendPasswordChangedNotice(params: {
  userId: string;
  email: string;
  name: string;
  tokenId: string;
  request?: NextRequest;
}) {
  const origin = getCanonicalAppOrigin(params.request);
  const content = passwordChangedNoticeEmail({ name: params.name, resetUrl: `${origin}/forgot-password` });
  await enqueueMail({
    toEmail: params.email,
    subject: content.subject,
    htmlBody: content.html,
    textBody: content.text,
    purpose: "password_changed",
    idempotencyKey: `password_changed:${params.userId}:${params.tokenId}`,
  });
  void processPendingMail().catch(() => undefined);
}

export async function sendPasswordReset(params: {
  userId: string;
  email: string;
  name: string;
  request?: NextRequest;
}) {
  const { rawToken, tokenId } = await issueAuthToken({
    userId: params.userId,
    purpose: "PASSWORD_RESET",
    ttlMs: PASSWORD_RESET_TTL_MS,
  });
  const origin = getCanonicalAppOrigin(params.request);
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const content = passwordResetEmail({ name: params.name, resetUrl });
  await enqueueMail({
    toEmail: params.email,
    subject: content.subject,
    htmlBody: content.html,
    textBody: content.text,
    purpose: "password_reset",
    idempotencyKey: `password_reset:${params.userId}:${tokenId}`,
    relatedTokenId: tokenId,
    supersedePurposeForEmail: true,
  });
  void processPendingMail().catch(() => undefined);
}
