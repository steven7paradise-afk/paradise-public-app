import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type BookingPayload = {
  serviceTitle?: string;
  serviceClass?: string;
  serviceSlug?: string;
  selectedDate?: string;
  selectedMonth?: string;
  selectedTime?: string;
  paymentMode?: string;
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return Response.json(
    { ok: true, service: "COWCALENDAR PB booking endpoint" },
    { headers: corsHeaders },
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json(
      { ok: false, error: "Metodo non supportato" },
      { status: 405, headers: corsHeaders },
    );
  }

  let payload: BookingPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Dati prenotazione non validi" },
      { status: 400, headers: corsHeaders },
    );
  }

  const apiKey = process.env.COWCALENDAR_API_KEY;
  const endpoint = process.env.COWCALENDAR_BOOKING_ENDPOINT;

  if (!apiKey || !endpoint) {
    return Response.json(
      {
        ok: true,
        mode: "queued",
        message:
          "Prenotazione ricevuta. Configura COWCALENDAR_API_KEY e COWCALENDAR_BOOKING_ENDPOINT per registrarla su Cowlendar.",
      },
      { headers: corsHeaders },
    );
  }

  const cowlendarResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Cowlendar-Api-Key": apiKey,
    },
    body: JSON.stringify({
      service: {
        title: payload.serviceTitle,
        class: payload.serviceClass,
        slug: payload.serviceSlug,
      },
      appointment: {
        date: payload.selectedDate,
        month: payload.selectedMonth,
        time: payload.selectedTime,
      },
      customer: payload.customer,
      paymentMode: payload.paymentMode,
      source: "paradise-cowcalendar-pb",
    }),
  });

  const responseText = await cowlendarResponse.text();

  if (!cowlendarResponse.ok) {
    return Response.json(
      {
        ok: false,
        error: "Cowlendar non ha accettato la prenotazione",
        status: cowlendarResponse.status,
        details: responseText.slice(0, 500),
      },
      { status: 502, headers: corsHeaders },
    );
  }

  return Response.json(
    {
      ok: true,
      mode: "cowlendar",
      status: cowlendarResponse.status,
      result: responseText.slice(0, 1000),
    },
    { headers: corsHeaders },
  );
};
