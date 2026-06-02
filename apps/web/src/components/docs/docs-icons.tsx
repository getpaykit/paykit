import {
  Blocks,
  BookMarked,
  BookOpen,
  Bot,
  ChevronDown,
  Code2,
  Coins,
  Compass,
  CreditCard,
  Database,
  Download,
  Gauge,
  GitCompareArrows,
  LayoutDashboard,
  Monitor,
  Package,
  ReceiptText,
  Repeat,
  Route,
  Rocket,
  Server,
  Shield,
  ShoppingCart,
  Terminal,
  Users,
  WalletCards,
  Webhook,
  BookText,
} from "lucide-react";
import type { ReactElement } from "react";

const categoryIcons = {
  "get started": <Compass className="docs-category-icon size-3.5! shrink-0" />,
  concepts: <BookText className="docs-category-icon size-3.5! shrink-0" />,
  flows: <Route className="docs-category-icon size-3.5! shrink-0" />,
  providers: <CreditCard className="docs-category-icon size-3.5! shrink-0" />,
  databases: <Database className="docs-category-icon size-3.5! shrink-0" />,
  integrations: <Blocks className="docs-category-icon size-3.5! shrink-0" />,
  plugins: <Blocks className="docs-category-icon size-3.5! shrink-0" />,
  guides: <BookMarked className="docs-category-icon size-3.5! shrink-0" />,
} as const;

const pageIcons = {
  introduction: <BookOpen className="docs-category-icon size-3! shrink-0" />,
  comparison: <GitCompareArrows className="docs-category-icon size-3! shrink-0" />,
  installation: <Download className="docs-category-icon size-3! shrink-0" />,
  quickstart: <Rocket className="docs-category-icon size-3! shrink-0" />,
  "server api": <Server className="docs-category-icon size-3! shrink-0" />,
  "react client": <Code2 className="docs-category-icon size-3! shrink-0" />,
  "webhook events": <Webhook className="docs-category-icon size-3! shrink-0" />,
  "basic usage": <Coins className="docs-category-icon size-3! shrink-0" />,
  usage: <Coins className="docs-category-icon size-3! shrink-0" />,
  database: <Database className="docs-category-icon size-3! shrink-0" />,
  typescript: <Code2 className="docs-category-icon size-3! shrink-0" />,
  "payment providers": <CreditCard className="docs-category-icon size-3! shrink-0" />,
  checkout: <ShoppingCart className="docs-category-icon size-3! shrink-0" />,
  "payment methods": <WalletCards className="docs-category-icon size-3! shrink-0" />,
  charges: <ReceiptText className="docs-category-icon size-3! shrink-0" />,
  postgres: <Database className="docs-category-icon size-3! shrink-0" />,
  sqlite: <Database className="docs-category-icon size-3! shrink-0" />,
  "drizzle adapter": <Database className="docs-category-icon size-3! shrink-0" />,
  "prisma adapter": <Database className="docs-category-icon size-3! shrink-0" />,
  nextjs: <Server className="docs-category-icon size-3! shrink-0" />,
  "next js": <Server className="docs-category-icon size-3! shrink-0" />,

  "create a payment provider": <CreditCard className="docs-category-icon size-3! shrink-0" />,
  "plans & features": <Package className="docs-category-icon size-3! shrink-0" />,
  customers: <Users className="docs-category-icon size-3! shrink-0" />,
  subscriptions: <Repeat className="docs-category-icon size-3! shrink-0" />,
  entitlements: <Shield className="docs-category-icon size-3! shrink-0" />,
  plugins: <Blocks className="docs-category-icon size-3! shrink-0" />,
  client: <Monitor className="docs-category-icon size-3! shrink-0" />,
  cli: <Terminal className="docs-category-icon size-3! shrink-0" />,
  "subscription billing": <Repeat className="docs-category-icon size-3! shrink-0" />,
  "metered usage": <Gauge className="docs-category-icon size-3! shrink-0" />,
  dashboard: <LayoutDashboard className="docs-category-icon size-3! shrink-0" />,
  skills: <Bot className="docs-category-icon size-3! shrink-0" />,
} as const;

const enabledProviders = new Set(["stripe"]);
const soonPages = new Set(["drizzleadapter", "prismaadapter", "dashboard"]);

const providerPageIcons = {
  stripe: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      className="docs-category-icon size-3! shrink-0 text-current"
    >
      <path
        fill="currentColor"
        d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409c0-.831.683-1.305 1.901-1.305c2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0C9.667 0 7.589.654 6.104 1.872C4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219c2.585.92 3.445 1.574 3.445 2.583c0 .98-.84 1.545-2.354 1.545c-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813c1.664-1.305 2.525-3.236 2.525-5.732c0-4.128-2.524-5.851-6.594-7.305z"
      />
    </svg>
  ),
} as const;

function normalizeCategoryName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replaceAll(".", "")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProviderKey(name: string): string {
  return normalizeCategoryName(name).replaceAll(" ", "");
}

export function getDocsCategoryIcon(name: string): ReactElement | undefined {
  return categoryIcons[normalizeCategoryName(name) as keyof typeof categoryIcons];
}

export function getDocsPageIcon(name: string): ReactElement | undefined {
  const key = normalizeCategoryName(name);
  const providerKey = normalizeProviderKey(name);

  return (
    pageIcons[key as keyof typeof pageIcons] ??
    providerPageIcons[providerKey as keyof typeof providerPageIcons]
  );
}

export function isProviderPage(name: string): boolean {
  return normalizeProviderKey(name) in providerPageIcons;
}

export function isEnabledProviderPage(name: string): boolean {
  return enabledProviders.has(normalizeProviderKey(name));
}

export function isSoonPage(name: string): boolean {
  return soonPages.has(normalizeProviderKey(name));
}

export function CategoryFolderIcon({ icon }: { icon?: ReactElement }) {
  return (
    <span className="contents">
      {icon}
      <ChevronDown className="docs-category-chevron pointer-events-none absolute top-1/2 right-5 size-4 -translate-y-1/2 transition-transform duration-150" />
    </span>
  );
}
