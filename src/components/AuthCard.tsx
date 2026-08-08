import { ReactNode } from 'react';

export default function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
      <div className="card elev-md" style={{ width: '100%', maxWidth: 380, padding: 'var(--space-8)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            background: 'var(--color-accent)',
            margin: '0 auto var(--space-5)',
          }}
        >
          <span style={{ color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18 }}>HN</span>
        </div>
        {children}
      </div>
    </div>
  );
}
