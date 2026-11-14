import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { Alert, Button, Card, CardContent, CheckboxField, Form, TextField } from '@/shared/design-system'
import { isApiError } from '@/shared/api/errors'
import { GoogleSignIn } from '../components/GoogleSignIn'
import { applyApiErrorsToForm } from '@/shared/utils/forms'
import { registerSchema, type RegisterFormValues } from '../schemas/auth.schema'
import { useRegister } from '../hooks/useAuth'

/** Cadastro gratuito: uma pessoa, uma conta independente. */
export default function RegisterPage() {
  const register = useRegister()

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', password_confirmation: '', accept_terms: false },
  })

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      await register.mutateAsync(values)
    } catch (error) {
      if (isApiError(error) && error.status === 422) {
        applyApiErrorsToForm(form, error)
      }
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-foreground">Criar conta</h1>
          <p className="mt-1 text-sm text-muted">Gratuito. Seus dados ficam só na sua conta.</p>
        </div>

        <div className="mb-5">
          <GoogleSignIn context="signup" />
        </div>

        {register.isError && isApiError(register.error) && register.error.status !== 422 && (
          <Alert variant="danger" title={register.error.message} className="mb-5" />
        )}

        <Form form={form} onSubmit={onSubmit}>
          <TextField name="name" label="Nome" autoComplete="name" required />
          <TextField name="email" label="E-mail" type="email" placeholder="voce@exemplo.com" autoComplete="email" required />
          <TextField name="password" label="Senha" type="password" autoComplete="new-password" hint="Mínimo de 8 caracteres." required />
          <TextField name="password_confirmation" label="Confirme a senha" type="password" autoComplete="new-password" required />
          <CheckboxField
            name="accept_terms"
            label="Concordo em guardar minhas medições de glicose nesta conta"
            description="São dados de saúde. Só você tem acesso a eles e pode apagá-los quando quiser."
          />
          <Button type="submit" className="w-full" loading={register.isPending}>
            Criar conta
          </Button>
        </Form>

        <p className="mt-6 text-center text-sm text-muted">
          Já tem uma conta?{' '}
          <Link to="/auth/login" className="font-medium text-primary hover:text-primary-hover">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
