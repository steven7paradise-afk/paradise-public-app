import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const query = new URL(request.url).searchParams.toString();
  throw redirect(`/app/campaigns${query ? `?${query}` : ""}`);
};
