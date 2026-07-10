import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterForm = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// RegisterScreen
// ---------------------------------------------------------------------------

/**
 * RegisterScreen handles new user account creation.
 * Redirects to app home on success via React Router.
 */
export function RegisterScreen() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterForm) => {
    setServerError(null);
    try {
      await registerUser(data.email, data.password, data.name);
      navigate('/', { replace: true });
    } catch (err: any) {
      setServerError(err.message ?? 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Create account</h2>
        <p className="text-xs text-muted-foreground">Enter your details to get started</p>
      </div>

      {serverError && (
        <div className="rounded-md bg-danger-bg border border-danger-text/20 px-3 py-2 text-xs text-danger-text">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="reg-name" className="text-xs font-medium text-foreground">
            Full name
          </label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            placeholder="Jane Smith"
            {...register('name')}
            className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {errors.name && (
            <p className="text-[10px] text-danger-text">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="text-xs font-medium text-foreground">
            Work email
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register('email')}
            className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {errors.email && (
            <p className="text-[10px] text-danger-text">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-password" className="text-xs font-medium text-foreground">
            Password
          </label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            {...register('password')}
            className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {errors.password && (
            <p className="text-[10px] text-danger-text">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 bg-accent text-accent-foreground text-xs font-semibold rounded-md transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{' '}
        <Link to="/auth/login" className="text-accent hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
