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
    const { restaurant_id, order_id, value, customer_name } = await req.json();

    if (!restaurant_id || !order_id || !value) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch restaurant's Asaas API key using service_role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: restaurant, error: restError } = await supabaseAdmin
      .from("restaurants")
      .select("asaas_api_key, name")
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

    // Create Asaas customer (simplified - using name only)
    const customerRes = await fetch(`${asaasBaseUrl}/api/v3/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify({
        name: customer_name || "Cliente",
        cpfCnpj: "00000000000", // placeholder for Pix
      }),
    });

    const customerData = await customerRes.json();
    const customerId = customerData.id;

    if (!customerId) {
      // Try without customer creation (some Asaas configs allow it)
      console.error("Customer creation failed:", customerData);
    }

    // Create Pix payment
    const dueDate = new Date();
    dueDate.setMinutes(dueDate.getMinutes() + 30);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const paymentRes = await fetch(`${asaasBaseUrl}/api/v3/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: value,
        dueDate: dueDateStr,
        description: `Pedido - ${restaurant.name}`,
        externalReference: order_id,
      }),
    });

    const paymentData = await paymentRes.json();

    if (!paymentData.id) {
      return new Response(
        JSON.stringify({ error: "Failed to create payment", details: paymentData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get QR Code
    const qrRes = await fetch(
      `${asaasBaseUrl}/api/v3/payments/${paymentData.id}/pixQrCode`,
      {
        headers: { access_token: asaasApiKey },
      }
    );

    const qrData = await qrRes.json();

    // Update order with payment_id
    await supabaseAdmin
      .from("orders")
      .update({
        payment_id: paymentData.id,
        payment_status: "PENDING",
      })
      .eq("id", order_id);

    return new Response(
      JSON.stringify({
        payment_id: paymentData.id,
        qr_code_base64: qrData.encodedImage || "",
        pix_payload: qrData.payload || "",
        expiration: dueDate.toISOString(),
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
