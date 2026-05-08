import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { logoutResponsible } from "../services/responsible-auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => logoutResponsible(request);
export const action = async ({ request }: ActionFunctionArgs) => logoutResponsible(request);
