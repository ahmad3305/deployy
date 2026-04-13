const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export interface AuthResponse {
  token: string;
  user: any; 
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Login failed.");

  sessionStorage.setItem("token", json.data.token);  // ✅ Changed
  sessionStorage.setItem("user", JSON.stringify(json.data.user));  // ✅ Changed

  return json.data;
}

export async function register(data: { email: string; password: string; [key: string]: any }): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Register failed.");

  sessionStorage.setItem("token", json.data.token);  // ✅ Changed
  sessionStorage.setItem("user", JSON.stringify(json.data.user));  // ✅ Changed

  return json.data;
}

export function logout() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  localStorage.removeItem("token");  // Cleanup old storage
  localStorage.removeItem("user");   // Cleanup old storage
}