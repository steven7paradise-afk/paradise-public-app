import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { ensureShopSettings } from "../services/shop-settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopSettings(session.shop);
  return { shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopSettings(session.shop);
  const formData = await request.formData();

  await prisma.shopSettings.update({
    where: { id: shop.id },
    data: {
      companyName: String(formData.get("companyName") || "").trim() || null,
      logoUrl: String(formData.get("logoUrl") || "").trim() || null,
      managerEmail: String(formData.get("managerEmail") || "").trim() || null,
      breakPaid: formData.get("breakPaid") === "on",
      forgottenClockHour: Number(formData.get("forgottenClockHour") || 22),
    },
  });

  return { success: "Impostazioni salvate." };
};

export default function SettingsPage() {
  const { shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const clockUrl = "https://www.paradisebeauty.it/apps/timbratura";

  return (
    <s-page heading="Impostazioni timbratura">
      {actionData?.success ? <s-banner tone="success">{actionData.success}</s-banner> : null}
      <s-section heading="Azienda e regole">
        <Form method="post" className="tc-form-grid">
          <label>
            Nome azienda
            <input name="companyName" defaultValue={shop.companyName || ""} />
          </label>
          <label>
            URL logo
            <input name="logoUrl" defaultValue={shop.logoUrl || ""} placeholder="https://..." />
          </label>
          <label>
            Email responsabile
            <input name="managerEmail" type="email" defaultValue={shop.managerEmail || ""} />
          </label>
          <label>
            Ora avviso uscita dimenticata
            <input name="forgottenClockHour" type="number" min={0} max={23} defaultValue={shop.forgottenClockHour} />
          </label>
          <label className="tc-checkbox">
            <input name="breakPaid" type="checkbox" defaultChecked={shop.breakPaid} />
            Pausa retribuita
          </label>
          <button type="submit">Salva impostazioni</button>
        </Form>
      </s-section>
      <s-section heading="Pagina lavoratore">
        <s-paragraph>
          Usa <code>{clockUrl}</code> come schermata lavoratore sul sito. Il collegamento passa da Shopify App Proxy.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
