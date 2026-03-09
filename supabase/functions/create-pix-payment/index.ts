import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const n8nWebhookUrl = Deno.env.get("N8N_PIX_WEBHOOK_URL");

    if (!n8nWebhookUrl) {
      return new Response(
        JSON.stringify({ error: "Payment webhook not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { order_id, restaurant_id, table_number } = await req.json();

    if (!order_id || !restaurant_id) {
      return new Response(
        JSON.stringify({ error: "Missing order_id or restaurant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Validate order exists, belongs to restaurant, and is in waiting_payment status
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, restaurant_id, total_price, status, payment_status")
      .eq("id", order_id)
      .eq("restaurant_id", restaurant_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (order.payment_status !== "PENDING" && order.status !== "waiting_payment") {
      return new Response(
        JSON.stringify({ error: "Order is not awaiting payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call n8n with validated data from DB (not from client)
    const res = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id,
        order_id: order.id,
        value: order.total_price,
        customer_name: `Mesa ${table_number || "S/N"}`,
        table_number,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("N8N webhook error:", errorText);
      return new Response(
        JSON.stringify({ error: "Payment generation failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pixResult = await res.json();
    return new Response(
      JSON.stringify(pixResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-pix-payment error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
