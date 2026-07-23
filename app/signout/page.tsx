import { signOut } from '@/auth';
import { TopNav } from '@/src/components/TopNav';

export const metadata = { title: 'Sign out — Tango Map' };

export default function SignOutPage() {
  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <TopNav />

        <div className="tm-nf">
          <p className="code">See you on the floor</p>
          <h1>Sign out of Tango Map?</h1>
          <p>Your progress is saved to your account — sign back in anytime to pick up right where you left off.</p>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            <button className="tm-cta" type="submit">
              Sign out <span className="tm-ar" aria-hidden="true">→</span>
            </button>
          </form>
          <p style={{ marginTop: '18px' }}>
            <a className="tm-link" href="/">Never mind — back to the map</a>
          </p>
        </div>
      </main>
    </div>
  );
}
