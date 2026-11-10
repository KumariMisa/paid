import Link from 'next/link';

export default function TopBar({ user, current }) {
  return (
    <header className="topbar">
      <Link href="/dashboard" className="brand"><span className="brand-mark" aria-hidden="true" />Paid</Link>
      <nav className="topnav" aria-label="Main">
        <Link href="/dashboard" aria-current={current === 'invoices' ? 'page' : undefined}>Invoices</Link>
        <Link href="/settings" aria-current={current === 'settings' ? 'page' : undefined}>Settings</Link>
      </nav>
      <div className="topbar-end">
        <span>{user.business_name}</span>
        <form action="/api/auth/logout" method="post"><button className="linkish" type="submit">Log out</button></form>
      </div>
    </header>
  );
}
