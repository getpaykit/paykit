"use server";

import { Resend } from "resend";

import { env } from "@/env";

import { validateContactForm } from "./validate";

const resend = new Resend(env.RESEND_API_KEY);

export async function submitContactForm(formData: FormData) {
  const validated = validateContactForm(formData);
  if (!validated.success) {
    return { error: validated.error };
  }
  const { name, email, company, message } = validated.data;

  try {
    const response = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: env.RESEND_TO_EMAIL,
      replyTo: email,
      subject: `Contact inquiry from ${name} at ${company}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Company: ${company}`,
        message ? `\nMessage:\n${message}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    if (response.error) {
      console.error("Failed to send contact inquiry", {
        error: response.error,
      });

      return { error: "Something went wrong. Please try again or email us directly." };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected contact inquiry error", error);

    return { error: "Something went wrong. Please try again or email us directly." };
  }
}
