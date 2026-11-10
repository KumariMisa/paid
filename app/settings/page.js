import { requireUser } from '@/lib/auth';
import { appBase } from '@/lib/urls';
import TopBar from '@/components/TopBar';
import SettingsForm from '@/components/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function Settings() {
  const user = await requireUser();
  return (
    <>
      <TopBar user={user} current="settings" />
      <main className="page">
        <div className="page-head"><h1>Settings</h1></div>
        <SettingsForm user={user} mcpBase={appBase()} isDemo={user.email === 'demo@paid.app'} />
      </main>
    </>
  );
}
