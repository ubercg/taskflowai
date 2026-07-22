import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { getUsers, getTeamVelocity } from '../services/api';
import UserCard from '../components/users/UserCard';
import NewUserModal from '../components/users/NewUserModal';
import { Button } from '../components/ui';

const UsersPage = () => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: users, error, mutate } = useSWR('/api/v1/users', () => getUsers(), { refreshInterval: 30000 });
  const { data: velocityData } = useSWR('/api/v1/metrics/velocity/team', getTeamVelocity, { refreshInterval: 30000, shouldRetryOnError: false });

  const isLoading = !users && !error;

  const filteredUsers = users
    ? users.filter((u) => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <div className="mx-auto max-w-[1200px] px-4">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-fg">{t('users.title')}</h1>
          <p className="mt-1 text-[15px] text-muted">{t('users.subtitle')}</p>
        </div>

        <div className="flex gap-3">
          <div className="relative">
            <svg className="absolute left-2.5 top-2.5 text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder={t('users.search.placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[250px] rounded-md border border-border bg-canvas py-2 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
            />
          </div>
          <Button onClick={() => setIsModalOpen(true)} size="sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            {t('users.newUser')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-16 text-muted">{t('users.loading')}</div>
      ) : error ? (
        <div className="rounded-lg border border-status-blocked/40 bg-status-blocked/10 p-4 text-status-blocked">
          {t('users.loadError')}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-16 text-center text-muted">
          {t('users.emptySearch')}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
          {filteredUsers.map((user) => {
            const vel = Array.isArray(velocityData) ? velocityData.find((v) => v.user_id === user.id || v.name === user.name) : {};
            return <UserCard key={user.id} user={user} velocity={vel || {}} />;
          })}
        </div>
      )}

      {isModalOpen && <NewUserModal onClose={() => setIsModalOpen(false)} onSuccess={() => mutate()} />}
    </div>
  );
};

export default UsersPage;
