import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail').email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe sua senha'),
})

export type LoginFormValues = z.infer<typeof loginSchema>


export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome'),
    email: z.email('Informe um e-mail válido'),
    password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres'),
    password_confirmation: z.string(),
    accept_terms: z.boolean().refine((v) => v, 'É preciso concordar para criar a conta'),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'As senhas não conferem',
  })

export type RegisterFormValues = z.infer<typeof registerSchema>
