import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginDtoSchema } from "@leadforge/validation";
import type { LoginDto } from "@leadforge/types";
import { FormCard } from "./form-card";
import { AuthHeader } from "./auth-header";
import { Divider } from "./divider";
import { SocialLoginPlaceholder } from "./social-placeholder";
import { AuthFooter } from "./auth-footer";

interface LoginFormProps {
  onSubmit: (data: LoginDto) => void;
  onNavigateToRegister: () => void;
  isLoading?: boolean;
}

/**
 * Standard credentials login form.
 * Uses React Hook Form with shared Zod validation from @leadforge/validation.
 */
export function LoginForm({
  onSubmit,
  onNavigateToRegister,
  isLoading = false,
}: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({
    resolver: zodResolver(loginDtoSchema as unknown as z.ZodType<any, any, any>),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  return (
    <FormCard>
      <AuthHeader
        title="Welcome to LeadForge OS"
        subtitle="Sign in with your professional credentials"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-[11px] font-medium text-neutral-400"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            placeholder="name@company.com"
            disabled={isLoading}
            className="w-full rounded-md border border-neutral-900 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-600 transition-colors focus:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-700 disabled:opacity-50"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-[10px] text-red-500 leading-none">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-[11px] font-medium text-neutral-400"
            >
              Password
            </label>
          </div>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            disabled={isLoading}
            className="w-full rounded-md border border-neutral-900 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-600 transition-colors focus:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-700 disabled:opacity-50"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-[10px] text-red-500 leading-none">
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center rounded-md bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <Divider label="or" />

      <SocialLoginPlaceholder />

      <AuthFooter
        message="Don't have an account?"
        linkText="Sign up"
        onLinkClick={onNavigateToRegister}
      />
    </FormCard>
  );
}
