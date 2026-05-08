import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { hashSecret } from "../services/auth.server";
import { ensureShopSettings } from "../services/shop-settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopSettings(session.shop);
  const admins = await prisma.adminUser.findMany({
    where: { shopId: shop.id },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return { admins };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopSettings(session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "deactivate") {
    await prisma.adminUser.update({
      where: { id: String(formData.get("adminId") || "") },
      data: { active: false },
    });
    return { success: "Admin disattivato." };
  }

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "MANAGER");

  if (!name || !email || password.length < 8) {
    return { error: "Inserisci nome, email e una password di almeno 8 caratteri." };
  }

  await prisma.adminUser.create({
    data: {
      shopId: shop.id,
      name,
      email,
      passwordHash: hashSecret(password),
      role,
    },
  });

  return { success: "Admin aggiunto." };
};

export default function AdminUsersPage() {
  const { admins } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading="Admin e responsabili">
      {actionData?.error ? <s-banner tone="critical">{actionData.error}</s-banner> : null}
      {actionData?.success ? <s-banner tone="success">{actionData.success}</s-banner> : null}

      <s-section heading="Nuovo accesso">
        <Form method="post" className="tc-form-grid">
          <input type="hidden" name="intent" value="create" />
          <label>
            Nome
            <input name="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" minLength={8} required />
          </label>
          <label>
            Ruolo
            <select name="role" defaultValue="MANAGER">
              <option value="OWNER">Proprietaria</option>
              <option value="MANAGER">Responsabile</option>
              <option value="REPORT_VIEWER">Solo report</option>
            </select>
          </label>
          <button type="submit">Aggiungi admin</button>
        </Form>
      </s-section>

      <s-section heading="Accessi configurati">
        <div className="tc-table-wrap">
          <table className="tc-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Ruolo</th>
                <th>Stato</th>
                <th>Azione</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td>{admin.name}</td>
                  <td>{admin.email}</td>
                  <td>{admin.role}</td>
                  <td>{admin.active ? "Attivo" : "Disattivato"}</td>
                  <td>
                    {admin.active ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="deactivate" />
                        <input type="hidden" name="adminId" value={admin.id} />
                        <button type="submit">Disattiva</button>
                      </Form>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </s-section>
    </s-page>
  );
}
