import { z } from "zod";

export const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  login_email: z.string().email().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(100).optional(),
  role: z.string().min(1).max(50),
  pobocka_id: z.string().optional(),
  initials: z.string().min(1).max(5).optional(),
  id: z.string().min(1).max(100).optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  login_email: z.string().email().optional(),
  initials: z.string().min(1).max(5).optional(),
  role: z.string().optional(),
  pobocka_id: z.string().optional(),
  notification_prefs: z.record(z.string(), z.boolean()).optional(),
  vzorove_inzeraty: z.array(z.string()).optional(),
  nav_prefs: z.array(z.string()).optional(),
  password: z.string().min(8).max(100).optional(),
});

export const CreateKlientSchema = z.object({
  meno: z.string().min(1).max(200),
  telefon: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  adresa: z.string().max(500).optional().nullable(),
  poznamka: z.string().max(5000).optional().nullable(),
  typ: z.string().optional().nullable(),
  user_id: z.string().min(1),
});

export const CreateNehnutelnostSchema = z.object({
  nazov: z.string().min(1).max(300).optional(),
  typ: z.string().optional(),
  lokalita: z.string().max(500).optional(),
  cena: z.number().nonnegative().optional().nullable(),
  plocha: z.number().nonnegative().optional().nullable(),
  klient_id: z.string().uuid().optional().nullable(),
  user_id: z.string().min(1),
});
