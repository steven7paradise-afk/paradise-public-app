import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const query = new URL(request.url).searchParams.toString();
  throw redirect(`/app/timeclock${query ? `?${query}` : ""}`);
};
