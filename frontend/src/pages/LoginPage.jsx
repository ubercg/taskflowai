import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/authStore';
import { Button, Input } from '../components/ui';
import { cn } from '../lib/cn';
import LanguageSelector from '../components/shared/LanguageSelector';

const FEATURE_KEYS = [
  { icon: '⚡', key: 'wip' },
  { icon: '📊', key: 'metrics' },
  { icon: '🤖', key: 'ai' },
];

const LoginPage = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/projects';

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch {
      // El error ya está manejado en el store
    }
  };

  return (
    <div className="flex min-h-screen w-screen bg-canvas">
      <div className="hidden flex-1 flex-col justify-center bg-gradient-to-br from-indigo-600 to-violet-700 p-16 text-white lg:flex">
        <div className="mx-auto w-full max-w-[480px]">
          <h1 className="mb-4 text-5xl font-extrabold tracking-tight">{t('common.brand')}</h1>
          <p className="mb-12 text-xl leading-relaxed opacity-90">{t('auth.login.tagline')}</p>

          <div className="flex flex-col gap-6">
            {FEATURE_KEYS.map((f) => (
              <div key={f.key} className="flex items-center gap-4">
                <div className="rounded-xl bg-white/20 p-3 text-xl" aria-hidden="true">{f.icon}</div>
                <span className="text-lg font-medium">{t(`auth.login.features.${f.key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center bg-surface p-8">
        <div className="absolute right-6 top-6">
          <LanguageSelector />
        </div>
        <div className="w-full max-w-[380px]">
          <h2 className="mb-2 text-2xl font-bold tracking-tight text-fg">{t('auth.login.welcomeTitle')}</h2>
          <p className="mb-8 text-[15px] text-muted">{t('auth.login.welcomeSubtitle')}</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-fg">{t('auth.login.email.label')}</label>
              <Input
                type="email"
                placeholder={t('auth.login.email.placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
                className={cn('py-3', error && 'border-status-blocked')}
              />
            </div>

            <div className="relative">
              <label className="mb-2 block text-sm font-medium text-fg">{t('auth.login.password.label')}</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.login.password.placeholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={cn('py-3 pr-12', error && 'border-status-blocked')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[34px] text-faint hover:text-muted"
                aria-label={showPassword ? t('auth.login.password.hideAria') : t('auth.login.password.showAria')}
              >
                <span aria-hidden="true">{showPassword ? '👁️' : '👁️‍🗨️'}</span>
              </button>
            </div>

            {error && <p className="text-[13px] text-status-blocked">{error}</p>}

            <Button
              type="submit"
              size="lg"
              disabled={isLoading || !email || !password}
              className="mt-2 w-full"
            >
              {isLoading ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>
          </form>

          <p className="mt-6 text-center text-[13px] text-muted">
            {t('auth.login.forgotPassword')}
          </p>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
