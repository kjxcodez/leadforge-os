import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { RegisterForm, type RegisterFormValues } from '../components/auth/register-form';

/**
 * RegisterScreen handles new user account creation.
 * It reads auth state from useAuth and delegates navigation to React Router.
 * No prop callbacks — the router resolves navigation declaratively.
 */
export function RegisterScreen() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await registerUser(data.email, data.password, data.name);
      navigate('/', { replace: true });
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <RegisterForm
        onSubmit={handleSubmit}
        onNavigateToLogin={() => navigate('/auth/login')}
        isLoading={isLoading}
        error={errorMsg}
      />
    </div>
  );
}
