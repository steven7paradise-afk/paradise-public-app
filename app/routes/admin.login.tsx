import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData } from "react-router";

import { getResponsibleSession, loginResponsible } from "../services/responsible-auth.server";
import "../styles/time-clock.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await getResponsibleSession(request);
  if (session.get("adminUserId")) throw redirect("/admin");
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const result = await loginResponsible(request, email, password);

  if (!result) {
    return { error: "Email o password non corretti." };
  }

  throw redirect("/admin", {
    headers: {
      "Set-Cookie": result.cookie,
    },
  });
};

export default function ResponsibleLoginPage() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="responsible-login-page">
      <section className="responsible-login-card">
        <img src="/paradise-logo-black.svg" alt="Paradise Beauty" />
        <p>Area responsabile</p>
        <h1>Accedi al pannello</h1>
        {actionData?.error ? <div className="responsible-error">{actionData.error}</div> : null}
        <Form method="post" className="responsible-login-form">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit">Entra</button>
        </Form>
      </section>
    </main>
  );
}
