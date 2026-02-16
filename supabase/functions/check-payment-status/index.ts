import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurant_id, payment_id } = await req.json();

    if (!restaurant_id || !payment_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: restaurant, error: restError } = await supabaseAdmin
      .from("restaurants")
      .select("asaas_api_key")
      .eq("id", restaurant_id)
      .single();

    if (restError || !restaurant?.asaas_api_key) {
      return new Response(
        JSON.stringify({ error: "Restaurant not found or missing API key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const asaasApiKey = restaurant.asaas_api_key;
    const asaasBaseUrl = asaasApiKey.startsWith("$aact_")
      ? "https://api.asaas.com"
      : "https://sandbox.asaas.com";

    const paymentRes = await fetch(
      `${asaasBaseUrl}/api/v3/payments/${payment_id}`,
      {
        headers: { access_token: asaasApiKey },
      }
    );

    const paymentData = await paymentRes.json();
    const status = paymentData.status; // PENDING, CONFIRMED, RECEIVED, etc.

    const isConfirmed = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(status);

    // If confirmed, update order status to pending (send to kitchen)
    if (isConfirmed) {
      await supabaseAdmin
        .from("orders")
        .update({
          status: "pending",
          payment_status: status,
        })
        .eq("payment_id", payment_id);
    } else {
      // Just update payment_status
      await supabaseAdmin
        .from("orders")
        .update({ payment_status: status })
        .eq("payment_id", payment_id);
    }

    return new Response(
      JSON.stringify({
        status,
        is_confirmed: isConfirmed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
