'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Role = 'Customer' | 'Staff' | 'Admin';

type RegisterCustomerPayload = {
  email: string;
  password: string;
  role: 'Customer';
  first_name: string;
  last_name: string;
  gender: 'male' | 'female';
  passport_number: string;
  nationality: string;
  date_of_birth: string; // YYYY-MM-DD
  contact_number: string;
};

type RegisterGenericPayload = {
  email: string;
  password: string;
  role: 'Staff' | 'Admin';
  staff_id?: number | null;
};

type RegisterResponse =
  | {
      success: true;
      message: string;
      data: {
        token: string;
        user: {
          user_id: number;
          email: string;
          role: Role;
          passenger_id: number | null;
          staff_id: number | null;
        };
      };
    }
  | {
      success: false;
      message: string;
      errors?: unknown;
    };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';

export default function RegisterPage() {
  const router = useRouter();

  const [role, setRole] = useState<Role>('Customer');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Customer/passenger fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [passportNumber, setPassportNumber] = useState('');
  const [nationality, setNationality] = useState('PK');
  const [dob, setDob] = useState('2003-01-01');
  const [contactNumber, setContactNumber] = useState('');

  // Staff/Admin optional id
  const [staffId, setStaffId] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const isCustomer = role === 'Customer';

  const canSubmit = useMemo(() => {
    if (!email || !password) return false;
    if (password.length < 6) return false;

    if (!isCustomer) return true;

    return (
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      passportNumber.trim().length > 0 &&
      nationality.trim().length > 0 &&
      dob.trim().length > 0 &&
      contactNumber.trim().length > 0
    );
  }, [email, password, isCustomer, firstName, lastName, passportNumber, nationality, dob, contactNumber]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      const url = `${API_BASE}/auth/register`;

      const payload: RegisterCustomerPayload | RegisterGenericPayload =
        role === 'Customer'
          ? {
              email,
              password,
              role: 'Customer',
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              gender,
              passport_number: passportNumber.trim(),
              nationality: nationality.trim(),
              date_of_birth: dob.trim(),
              contact_number: contactNumber.trim(),
            }
          : {
              email,
              password,
              role,
              staff_id: staffId ? Number(staffId) : null,
            };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as RegisterResponse;

      if (!res.ok || !json.success) {
        setError(json?.message || 'Registration failed');
        return;
      }

      // Simple token storage for now
      localStorage.setItem('token', json.data.token);
      localStorage.setItem('user', JSON.stringify(json.data.user));

      // Redirect (you can later redirect by role)
      router.push('/login');
    } catch (err: any) {
      setError(err?.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Create account</h1>

        <form onSubmit={onSubmit} style={styles.form}>
          <label style={styles.label}>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={styles.input}>
              <option value="Customer">Customer</option>
              <option value="Staff">Staff</option>
              <option value="Admin">Admin</option>
            </select>
          </label>

          <label style={styles.label}>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={styles.input} />
          </label>

          <label style={styles.label}>
            Password (min 6 chars)
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" style={styles.input} />
          </label>

          {isCustomer ? (
            <>
              <hr style={styles.hr} />
              <h2 style={styles.sectionTitle}>Passenger details</h2>

              <div style={styles.grid2}>
                <label style={styles.label}>
                  First name
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={styles.input} />
                </label>

                <label style={styles.label}>
                  Last name
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={styles.input} />
                </label>
              </div>

              <div style={styles.grid2}>
                <label style={styles.label}>
                  Gender
                  <select value={gender} onChange={(e) => setGender(e.target.value as any)} style={styles.input}>
                    <option value="male">male</option>
                    <option value="female">female</option>
                  </select>
                </label>

                <label style={styles.label}>
                  Date of birth
                  <input value={dob} onChange={(e) => setDob(e.target.value)} type="date" style={styles.input} />
                </label>
              </div>

              <label style={styles.label}>
                Passport number
                <input value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} style={styles.input} />
              </label>

              <div style={styles.grid2}>
                <label style={styles.label}>
                  Nationality
                  <input value={nationality} onChange={(e) => setNationality(e.target.value)} style={styles.input} />
                </label>

                <label style={styles.label}>
                  Contact number
                  <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} style={styles.input} />
                </label>
              </div>
            </>
          ) : (
            <>
              <hr style={styles.hr} />
              <h2 style={styles.sectionTitle}>Staff/Admin (optional)</h2>
              <label style={styles.label}>
                Staff ID (optional)
                <input
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  inputMode="numeric"
                  placeholder="e.g. 12"
                  style={styles.input}
                />
              </label>
            </>
          )}

          {error ? <p style={styles.error}>{error}</p> : null}

          <button type="submit" disabled={!canSubmit || loading} style={styles.button}>
            {loading ? 'Creating...' : 'Register'}
          </button>

          <p style={styles.footer}>
            Already have an account? <a href="/login">Login</a>
          </p>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    background: '#0b1220',
    color: '#e5e7eb',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 14,
    padding: 20,
  },
  title: { margin: 0, marginBottom: 12, fontSize: 26 },
  sectionTitle: { margin: '12px 0 8px', fontSize: 16, color: '#cbd5e1' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#cbd5e1' },
  input: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#0b1220',
    color: '#e5e7eb',
    outline: 'none',
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  hr: { border: 0, borderTop: '1px solid #1f2937', margin: '8px 0' },
  button: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#2563eb',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: { margin: 0, color: '#fca5a5', fontSize: 14 },
  footer: { margin: '6px 0 0', fontSize: 14, color: '#9ca3af' },
};