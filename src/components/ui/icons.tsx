// Inline icon set.
//
// The brief rules out emoji-dependent UI (docs/PRD.md §48), and a full icon
// package would ship far more than the two dozen glyphs this app uses. These
// are stroke icons on a 24px grid, sized by the surrounding font-size, and
// `aria-hidden` by default — an icon beside a label is decoration, and an
// icon on its own gets a `title` from the caller.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Icon({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const CartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
    <circle cx="10" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
  </Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const PinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
);

export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3Z" />
  </Icon>
);

export const WhatsappIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 20.5 5 16.3A8 8 0 1 1 8.2 19.3l-4.7 1.2Z" />
    <path d="M9 9.5c.4 2.3 3.2 5.1 5.5 5.5.6.1 1.3-.4 1.5-1l.2-.7-2-1-.8.9a6.6 6.6 0 0 1-2.6-2.6l.9-.8-1-2-.7.2c-.6.2-1.1.9-1 1.5Z" />
  </Icon>
);

export const InstagramIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12.5 9 17.5 20 6.5" />
  </Icon>
);

export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.2l2.7 2.7L16 9.6" />
  </Icon>
);

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4 2.8 20h18.4L12 4Z" />
    <path d="M12 10v4M12 17.2v.1" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.1" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Icon>
);

export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
    <path d="M14.5 5.5 18.5 9.5" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Icon>
);

export const ChevronIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);

export const ReceiptIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3h12v18l-3-1.6L12 21l-3-1.6L6 21V3Z" />
    <path d="M9.5 8h5M9.5 12h5" />
  </Icon>
);

export const WalletIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="6" width="18" height="13" rx="3" />
    <path d="M3 10h18M16.5 14.5h.01" />
  </Icon>
);

export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);

export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 6.2a3.2 3.2 0 0 1 0 6M17.5 20a6 6 0 0 0-1.6-4" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8l1.2 2.3 2.5-.5.6 2.5 2.3 1.1-1.2 2.3 1.2 2.3-2.3 1.1-.6 2.5-2.5-.5L12 21.2l-1.2-2.3-2.5.5-.6-2.5-2.3-1.1 1.2-2.3-1.2-2.3 2.3-1.1.6-2.5 2.5.5L12 2.8Z" />
  </Icon>
);

export const PizzaIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 21 19a13 13 0 0 1-18 0L12 3Z" />
    <circle cx="10.5" cy="13" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="14" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
);

export const DrinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 5h10l-1.2 15.2a1 1 0 0 1-1 .8H9.2a1 1 0 0 1-1-.8L7 5Z" />
    <path d="M7.4 10h9.2" />
  </Icon>
);

export const DessertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 11h14l-1.5 8.2a1 1 0 0 1-1 .8H7.5a1 1 0 0 1-1-.8L5 11Z" />
    <path d="M7.5 11a4.5 4.5 0 0 1 9 0" />
    <path d="M12 6.5V4.8" />
  </Icon>
);

export const SidesIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10h16l-1.4 9.2a1 1 0 0 1-1 .8H6.4a1 1 0 0 1-1-.8L4 10Z" />
    <path d="M8 10V5.5M12 10V4.5M16 10V6" />
  </Icon>
);

export const FireIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3s5 4 5 8.5a5 5 0 0 1-10 0C7 9 9 7 9 7s.5 2 1.5 2.5C11 8 12 6 12 3Z" />
  </Icon>
);

export const StarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.7l5.4-.8L12 4Z" />
  </Icon>
);

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="10.5" width="16" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </Icon>
);

export const ListIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </Icon>
);

export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
);

export const TagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 11V4h7l10 10-7 7L3 11Z" />
    <circle cx="7.5" cy="7.5" r="1.3" />
  </Icon>
);

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5v14M15 5v14" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.5 19 12 7 19.5v-15Z" />
  </Icon>
);

export const CategoryIcon = ({ name, ...props }: Omit<IconProps, "name"> & { name?: string | null }) => {
  switch (name) {
    case "pizza":
      return <PizzaIcon {...props} />;
    case "drinks":
      return <DrinkIcon {...props} />;
    case "desserts":
      return <DessertIcon {...props} />;
    case "sides":
      return <SidesIcon {...props} />;
    default:
      return <ListIcon {...props} />;
  }
};

export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </Icon>
);

export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v12" />
    <path d="M8 7l4-4 4 4" />
    <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11" />
    <path d="M8 11l4 4 4-4" />
    <path d="M5 19h14" />
  </Icon>
);

export const NavigationIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l7 17-7-4-7 4 7-17z" />
  </Icon>
);
