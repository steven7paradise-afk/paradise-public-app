import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

const DEFAULT_SHOP = process.env.SHOPIFY_DEFAULT_SHOP || "c1uzax-u0.myshopify.com";

function shopFromRequest(request: Request) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (shop) return shop;

  const referer = request.headers.get("referer");
  if (referer) {
    const match = referer.match(/admin\.shopify\.com\/store\/([^/?#]+)/);
    if (match?.[1]) return `${match[1]}.myshopify.com`;
  }

  return DEFAULT_SHOP;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (!url.searchParams.get("shop")) {
    url.searchParams.set("shop", shopFromRequest(request));
    throw new Response(null, {
      status: 302,
      headers: { Location: url.toString() },
    });
  }

  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.clone().formData();
  const postedShop = formData.get("shop");
  if (!postedShop) {
    const url = new URL(request.url);
    url.searchParams.set("shop", shopFromRequest(request));
    throw new Response(null, {
      status: 302,
      headers: { Location: url.toString() },
    });
  }

  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  return (
    <AppProvider embedded={false}>
      <s-page>
        <Form method="post">
        <s-section heading="Log in">
          <s-text-field
            name="shop"
            label="Shop domain"
            details="example.myshopify.com"
            value={shop}
            onChange={(e) => setShop(e.currentTarget.value)}
            autocomplete="on"
            error={errors.shop}
          ></s-text-field>
          <s-button type="submit">Log in</s-button>
        </s-section>
        </Form>
      </s-page>
    </AppProvider>
  );
}
