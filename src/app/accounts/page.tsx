import { requireAdmin } from "@/lib/auth";
import { rows } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { Header, Notice, type SearchParams } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { createUser } from "@/app/actions";
export default async function Accounts({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = await requireAdmin();
  const users = await rows<SessionUser>(
    "SELECT user_id, college_id, full_name, role FROM users ORDER BY user_id",
  );
  return (
    <>
      <Header user={admin} />
      <main className="container">
        <div className="page-heading">
          <span className="eyebrow">SECURITY / ADMIN</span>
          <h1>Campus accounts.</h1>
          <p>Create sign-in details and share them in person.</p>
        </div>
        <Notice {...await searchParams} />
        <div className="accounts-grid">
          <form action={createUser} className="panel form-stack">
            <h2>Create an account</h2>
            <label>
              Full name
              <input name="full_name" maxLength={100} required />
            </label>
            <label>
              College ID
              <input name="college_id" maxLength={30} required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                required
              />
              <span className="help-text">At least 8 characters.</span>
            </label>
            <label>
              Role
              <select name="role">
                <option value="user">Regular user</option>
                <option value="admin">Security / Admin</option>
              </select>
            </label>
            <SubmitButton>Create account</SubmitButton>
          </form>
          <section className="panel account-list">
            <h2>
              Existing accounts <span className="count">{users.length}</span>
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>College ID</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id}>
                    <td>{u.full_name}</td>
                    <td>{u.college_id}</td>
                    <td>{u.role === "admin" ? "Security / Admin" : "User"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </>
  );
}
