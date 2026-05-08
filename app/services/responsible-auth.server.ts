import { createCookieSessionStorage, redirect } from "react-router";

import prisma from "../db.server";
import { hashSecret } from "./auth.server";

const sessionSecret = process.env.ADMIN_SESSION_SECRET || process.env.SHOPIFY_API_SECRET || "paradise-admin-dev";

const responsibleSession = createCookieSessionStorage({
  cookie: {
    name: "__paradise_responsible",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  },
});

export async function getResponsibleSession(request: Request) {
  return responsibleSession.getSession(request.headers.get("Cookie"));
}

export async function requireResponsible(request: Request) {
  const session = await getResponsibleSession(request);
  const adminId = session.get("adminUserId");

  if (!adminId || typeof adminId !== "string") {
    throw redirect("/admin/login");
  }

  const admin = await prisma.adminUser.findFirst({
    where: { id: adminId, active: true },
    include: { shop: true },
  });

  if (!admin) {
    throw redirect("/admin/login", {
      headers: {
        "Set-Cookie": await responsibleSession.destroySession(session),
      },
    });
  }

  return admin;
}

export async function loginResponsible(request: Request, email: string, password: string) {
  const admin = await prisma.adminUser.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      active: true,
    },
    include: { shop: true },
  });

  if (!admin || admin.passwordHash !== hashSecret(password)) {
    return null;
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  const session = await getResponsibleSession(request);
  session.set("adminUserId", admin.id);

  return {
    admin,
    cookie: await responsibleSession.commitSession(session),
  };
}

export async function logoutResponsible(request: Request) {
  const session = await getResponsibleSession(request);
  return redirect("/admin/login", {
    headers: {
      "Set-Cookie": await responsibleSession.destroySession(session),
    },
  });
}
