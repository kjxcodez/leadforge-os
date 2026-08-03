import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoginForm } from '../components/auth/login-form';
import type { LoginDto } from '@leadforge/schema';

/**
 * LoginScreen handles user authentication.
 * It reads auth state from useAuth and delegates navigation to React Router.
 * No prop callbacks — the router resolves navigation declaratively.
 */
export function LoginScreen() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (data: LoginDto) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await login(data.email, data.password ?? '');
      navigate('/', { replace: true });
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <LoginForm
        onSubmit={handleSubmit}
        onNavigateToRegister={() => navigate('/auth/register')}
        isLoading={isLoading}
        error={errorMsg}
      />
    </div>
  );
}
