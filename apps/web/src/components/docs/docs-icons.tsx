import type { ReactElement } from "react";
import {
  RiArrowDownSLine,
  RiBankCardLine,
  RiBookMarkedLine,
  RiBookOpenLine,
  RiBookReadLine,
  RiBox3Line,
  RiCodeSSlashLine,
  RiCoinsLine,
  RiCompassLine,
  RiComputerLine,
  RiDashboardLine,
  RiDatabase2Line,
  RiDownloadLine,
  RiGitForkLine,
  RiGroupLine,
  RiPuzzle2Line,
  RiReceiptLine,
  RiRepeatLine,
  RiRobot2Line,
  RiRocketLine,
  RiRouteLine,
  RiServerLine,
  RiShieldLine,
  RiShoppingCartLine,
  RiSpeedUpLine,
  RiTerminalBoxLine,
  RiWalletLine,
  RiWebhookLine,
} from "react-icons/ri";

const categoryIcons = {
  "get started": <RiCompassLine className="docs-category-icon size-3.5! shrink-0" />,
  concepts: <RiBookReadLine className="docs-category-icon size-3.5! shrink-0" />,
  flows: <RiRouteLine className="docs-category-icon size-3.5! shrink-0" />,
  providers: <RiBankCardLine className="docs-category-icon size-3.5! shrink-0" />,
  databases: <RiDatabase2Line className="docs-category-icon size-3.5! shrink-0" />,
  integrations: <RiPuzzle2Line className="docs-category-icon size-3.5! shrink-0" />,
  plugins: <RiPuzzle2Line className="docs-category-icon size-3.5! shrink-0" />,
  guides: <RiBookMarkedLine className="docs-category-icon size-3.5! shrink-0" />,
} as const;

const pageIcons = {
  introduction: <RiBookOpenLine className="docs-category-icon size-3! shrink-0" />,
  comparison: <RiGitForkLine className="docs-category-icon size-3! shrink-0" />,
  installation: <RiDownloadLine className="docs-category-icon size-3! shrink-0" />,
  quickstart: <RiRocketLine className="docs-category-icon size-3! shrink-0" />,
  "server api": <RiServerLine className="docs-category-icon size-3! shrink-0" />,
  "react client": <RiCodeSSlashLine className="docs-category-icon size-3! shrink-0" />,
  "webhook events": <RiWebhookLine className="docs-category-icon size-3! shrink-0" />,
  "basic usage": <RiCoinsLine className="docs-category-icon size-3! shrink-0" />,
  usage: <RiCoinsLine className="docs-category-icon size-3! shrink-0" />,
  database: <RiDatabase2Line className="docs-category-icon size-3! shrink-0" />,
  typescript: <RiCodeSSlashLine className="docs-category-icon size-3! shrink-0" />,
  checkout: <RiShoppingCartLine className="docs-category-icon size-3! shrink-0" />,
  "payment methods": <RiWalletLine className="docs-category-icon size-3! shrink-0" />,
  charges: <RiReceiptLine className="docs-category-icon size-3! shrink-0" />,
  postgres: <RiDatabase2Line className="docs-category-icon size-3! shrink-0" />,
  sqlite: <RiDatabase2Line className="docs-category-icon size-3! shrink-0" />,
  "drizzle adapter": <RiDatabase2Line className="docs-category-icon size-3! shrink-0" />,
  "prisma adapter": <RiDatabase2Line className="docs-category-icon size-3! shrink-0" />,
  nextjs: <RiServerLine className="docs-category-icon size-3! shrink-0" />,
  "next js": <RiServerLine className="docs-category-icon size-3! shrink-0" />,

  "create a payment provider": <RiBankCardLine className="docs-category-icon size-3! shrink-0" />,
  "plans & features": <RiBox3Line className="docs-category-icon size-3! shrink-0" />,
  customers: <RiGroupLine className="docs-category-icon size-3! shrink-0" />,
  subscriptions: <RiRepeatLine className="docs-category-icon size-3! shrink-0" />,
  entitlements: <RiShieldLine className="docs-category-icon size-3! shrink-0" />,
  plugins: <RiPuzzle2Line className="docs-category-icon size-3! shrink-0" />,
  client: <RiComputerLine className="docs-category-icon size-3! shrink-0" />,
  cli: <RiTerminalBoxLine className="docs-category-icon size-3! shrink-0" />,
  "subscription billing": <RiRepeatLine className="docs-category-icon size-3! shrink-0" />,
  "metered usage": <RiSpeedUpLine className="docs-category-icon size-3! shrink-0" />,
  dashboard: <RiDashboardLine className="docs-category-icon size-3! shrink-0" />,
  skills: <RiRobot2Line className="docs-category-icon size-3! shrink-0" />,
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
      <RiArrowDownSLine className="docs-category-chevron pointer-events-none absolute top-1/2 right-5 size-4 -translate-y-1/2 transition-transform duration-150" />
    </span>
  );
}
