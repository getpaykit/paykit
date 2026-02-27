"use client";

import { CodeBlock, t } from "@/components/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const subscriptionsCode = (
  <>
    {t.kw("await")} {t.prop("pk")}
    {t.plain(".")}
    {t.fn("api.createSubscription")}
    {t.plain("({")}
    {"\n"}
    {"  "}
    {t.prop("customerId")}
    {t.plain(": ")}
    {t.str('"cust_abc"')}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("amount")}
    {t.plain(": ")}
    {t.plain("2900")}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("interval")}
    {t.plain(": ")}
    {t.str('"month"')}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("description")}
    {t.plain(": ")}
    {t.str('"Pro Plan"')}
    {t.plain(",")}
    {"\n"}
    {t.plain("});")}
  </>
);

const checkoutCode = (
  <>
    {t.kw("const")} {t.prop("checkout")} {t.plain("=")} {t.kw("await")}{" "}
    {t.prop("pk")}
    {t.plain(".")}
    {t.fn("api.createCheckout")}
    {t.plain("({")}
    {"\n"}
    {"  "}
    {t.prop("customerId")}
    {t.plain(": ")}
    {t.str('"cust_abc"')}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("amount")}
    {t.plain(": ")}
    {t.plain("9900")}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("description")}
    {t.plain(": ")}
    {t.str('"Lifetime License"')}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("successURL")}
    {t.plain(": ")}
    {t.str('"/success"')}
    {t.plain(",")}
    {"\n"}
    {t.plain("});")}
  </>
);

const usageCode = (
  <>
    {t.kw("await")} {t.prop("pk")}
    {t.plain(".")}
    {t.fn("api.reportUsage")}
    {t.plain("({")}
    {"\n"}
    {"  "}
    {t.prop("subscriptionId")}
    {t.plain(": ")}
    {t.str('"sub_abc"')}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("metric")}
    {t.plain(": ")}
    {t.str('"api_calls"')}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("value")}
    {t.plain(": ")}
    {t.plain("1500")}
    {t.plain(",")}
    {"\n"}
    {t.plain("});")}
  </>
);

const paymentMethodsCode = (
  <>
    {t.kw("const")} {t.prop("result")} {t.plain("=")} {t.kw("await")}{" "}
    {t.prop("pk")}
    {t.plain(".")}
    {t.fn("api.attachPaymentMethod")}
    {t.plain("({")}
    {"\n"}
    {"  "}
    {t.prop("customerId")}
    {t.plain(": ")}
    {t.str('"cust_abc"')}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("returnURL")}
    {t.plain(": ")}
    {t.str('"https://myapp.com/settings/billing"')}
    {t.plain(",")}
    {"\n"}
    {t.plain("});")}
    {"\n"}
    {t.comment("// result.url → redirect user to provider-hosted card form")}
    {"\n"}
    {"\n"}
    {t.kw("const")} {t.prop("methods")} {t.plain("=")} {t.kw("await")}{" "}
    {t.prop("pk")}
    {t.plain(".")}
    {t.fn("api.listPaymentMethods")}
    {t.plain("({ ")}
    {t.prop("customerId")}
    {t.plain(": ")}
    {t.str('"cust_abc"')}
    {t.plain(" });")}
    {"\n"}
    {"\n"}
    {t.kw("await")} {t.prop("pk")}
    {t.plain(".")}
    {t.fn("api.setDefaultPaymentMethod")}
    {t.plain("({")}
    {"\n"}
    {"  "}
    {t.prop("customerId")}
    {t.plain(": ")}
    {t.str('"cust_abc"')}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("paymentMethodId")}
    {t.plain(": ")}
    {t.str('"pm_xyz"')}
    {t.plain(",")}
    {"\n"}
    {t.plain("});")}
  </>
);

const invoicesCode = (
  <>
    {t.kw("const")} {t.prop("invoice")} {t.plain("=")} {t.kw("await")}{" "}
    {t.prop("pk")}
    {t.plain(".")}
    {t.fn("api.createInvoice")}
    {t.plain("({")}
    {"\n"}
    {"  "}
    {t.prop("customerId")}
    {t.plain(": ")}
    {t.str('"cust_abc"')}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("lines")}
    {t.plain(": [")}
    {"\n"}
    {"    "}
    {t.plain("{ ")}
    {t.prop("description")}
    {t.plain(": ")}
    {t.str('"Consulting — Jan 2026"')}
    {t.plain(", ")}
    {t.prop("amount")}
    {t.plain(": ")}
    {t.plain("50000")}
    {t.plain(", ")}
    {t.prop("quantity")}
    {t.plain(": ")}
    {t.plain("1")}
    {t.plain(" },")}
    {"\n"}
    {"    "}
    {t.plain("{ ")}
    {t.prop("description")}
    {t.plain(": ")}
    {t.str('"Setup fee"')}
    {t.plain(", ")}
    {t.prop("amount")}
    {t.plain(": ")}
    {t.plain("10000")}
    {t.plain(", ")}
    {t.prop("quantity")}
    {t.plain(": ")}
    {t.plain("1")}
    {t.plain(" },")}
    {"\n"}
    {"  "}
    {t.plain("],")}
    {"\n"}
    {"  "}
    {t.prop("dueDate")}
    {t.plain(": ")}
    {t.str('"2026-02-28"')}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("autoCollect")}
    {t.plain(": ")}
    {t.plain("true")}
    {t.plain(",")}
    {"\n"}
    {t.plain("});")}
  </>
);

const webhooksCode = (
  <>
    {t.comment("// Next.js — app/api/paykit/[...path]/route.ts")}
    {"\n"}
    {t.kw("export")} {t.kw("const")} {t.plain("{ ")} {t.prop("GET")}
    {t.plain(", ")}
    {t.prop("POST")} {t.plain("}")} {t.plain("=")} {t.prop("pk")}
    {t.plain(".")}
    {t.prop("handler")}
    {t.plain(";")}
    {"\n"}
    {"\n"}
    {t.comment("// Hono")}
    {"\n"}
    {t.prop("app")}
    {t.plain(".")}
    {t.fn("all")}
    {t.plain("(")}
    {t.str('"/api/paykit/*"')}
    {t.plain(", (")}
    {t.prop("c")}
    {t.plain(") => ")}
    {t.prop("pk")}
    {t.plain(".")}
    {t.fn("handler")}
    {t.plain("(")}
    {t.prop("c")}
    {t.plain(".")}
    {t.prop("req")}
    {t.plain(".")}
    {t.prop("raw")}
    {t.plain("));")}
    {"\n"}
  </>
);

const eventsCode = (
  <>
    {t.kw("const")} {t.prop("pk")} {t.plain("=")} {t.fn("paykit")}
    {t.plain("({")}
    {"\n"}
    {"  "}
    {t.plain("...")}
    {t.plain(",")}
    {"\n"}
    {"  "}
    {t.prop("on")}
    {t.plain(": {")}
    {"\n"}
    {"    "}
    {t.str('"subscription.activated"')}
    {t.plain(": ")}
    {t.kw("async")}
    {t.plain(" ({ ")}
    {t.prop("subscription")}
    {t.plain(", ")}
    {t.prop("customer")}
    {t.plain(" }) => {")}
    {"\n"}
    {"      "}
    {t.kw("await")} {t.fn("sendEmail")}
    {t.plain("(")}
    {t.prop("customer")}
    {t.plain(".")}
    {t.prop("email")}
    {t.plain(", ")}
    {t.str('"Welcome to Pro!"')}
    {t.plain(");")}
    {"\n"}
    {"    "}
    {t.plain("},")}
    {"\n"}
    {"    "}
    {t.str('"charge.failed"')}
    {t.plain(": ")}
    {t.kw("async")}
    {t.plain(" ({ ")}
    {t.prop("charge")}
    {t.plain(", ")}
    {t.prop("customer")}
    {t.plain(" }) => {")}
    {"\n"}
    {"      "}
    {t.kw("await")} {t.fn("notifyTeam")}
    {t.plain("(`Payment failed for ${")}
    {t.prop("customer")}
    {t.plain(".")}
    {t.prop("email")}
    {t.plain("}`);")}
    {"\n"}
    {"    "}
    {t.plain("},")}
    {"\n"}
    {"  "}
    {t.plain("},")}
    {"\n"}
    {t.plain("});")}
  </>
);

const tabs = [
  { value: "subscriptions", label: "Subscriptions", code: subscriptionsCode },
  { value: "checkout", label: "Checkout", code: checkoutCode },
  { value: "usage", label: "Usage", code: usageCode },
  {
    value: "payment-methods",
    label: "Payment Methods",
    code: paymentMethodsCode,
  },
  { value: "invoices", label: "Invoices", code: invoicesCode },
  { value: "webhooks", label: "Webhooks", code: webhooksCode },
  { value: "events", label: "Events", code: eventsCode },
];

export function CodeShowcaseSection() {
  return (
    <section className="py-24 px-6 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground text-center">
          Everything you need.
          <br />
          Nothing you don&apos;t.
        </h2>

        <Tabs defaultValue="subscriptions" className="mt-12">
          <div className="w-full overflow-x-auto">
            <TabsList
              variant="line"
              className="min-w-max border-b border-border w-full rounded-none pb-0"
            >
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none text-xs sm:text-sm"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              <CodeBlock>{tab.code}</CodeBlock>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
