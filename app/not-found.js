import Link from 'next/link';
export default function NotFound() {
  return <main className="public"><div className="empty"><h1 style={{ fontSize: 26 }}>Page not found</h1><p><Link href="/dashboard">Go to your invoices</Link></p></div></main>;
}
