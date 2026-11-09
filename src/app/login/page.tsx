import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { Notice, type SearchParams } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
export default async function Login({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (await currentUser()) redirect("/items");
  const params = await searchParams;
  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="login-brand">↗ Campus Lost &amp; Found</div>
        <span className="eyebrow">A LITTLE HELP, A FAMILIAR PLACE</span>
        <h1>
          Good things
          <br />
          find their
          <br />
          <em>way back.</em>
        </h1>
        <p>
          Found something on campus? Leave it with security.
          <br />
          Missing something? It might already be here.
        </p>
        <div className="login-note">
          <span>01 / Submit</span>
          <span>02 / Browse</span>
          <span>03 / Collect</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <span className="eyebrow">YOUR CAMPUS CONNECTION</span>
          <h2>Welcome back.</h2>
          <p>Sign in with your college ID to continue.</p>
          <Notice {...params} />
          <form action={login} className="form-stack">
            <label>
              College ID
              <input
                name="college_id"
                autoComplete="username"
                maxLength={30}
                required
                placeholder="e.g. STU001"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                required
                placeholder="Enter your password"
              />
            </label>
            <SubmitButton>
              Sign in <span aria-hidden="true">→</span>
            </SubmitButton>
          </form>
          <p className="help-text">
            Need an account? Contact the campus security desk.
          </p>
        </div>
      </section>
    </main>
  );
}
