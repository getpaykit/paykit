import { z } from "zod";

const subjectField = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !/[\r\n]/u.test(value));

const contactSchema = z.object({
  name: subjectField,
  email: z.string().trim().email().max(254),
  company: subjectField,
  message: z.string().trim().max(5000),
});

/** Validates contact data before any email is sent. */
export function validateContactForm(formData: FormData) {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const result = contactSchema.safeParse({
    name: field("name"),
    email: field("email"),
    company: field("company"),
    message: field("message"),
  });

  return result.success
    ? ({ success: true, data: result.data } as const)
    : ({ success: false, error: "Please check the form fields and try again." } as const);
}
