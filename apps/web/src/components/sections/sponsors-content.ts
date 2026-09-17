export interface Sponsor {
  name: string;
  href: string;
  image: string;
  imageAlt: string;
  amount: string;
  kind: "company" | "individual";
  hideInSingleColumn?: boolean;
}

export const sponsors: Sponsor[] = [
  {
    name: "Vercel",
    href: "https://vercel.com/home",
    image: "/companies/vercel-mark.svg",
    imageAlt: "Vercel logo",
    amount: "$10,000 credits",
    kind: "company",
  },
  {
    name: "Efferd",
    href: "https://efferd.com",
    image: "/companies/efferd.svg",
    imageAlt: "Efferd logo",
    amount: "$250 credits",
    kind: "company",
  },
  {
    name: "MrPancakes39",
    href: "https://x.com/mrpancakes39",
    image: "https://pbs.twimg.com/profile_images/1991510200386207744/2Bfvjltn_200x200.jpg",
    imageAlt: "MrPancakes39's X avatar",
    amount: "$100",
    kind: "individual",
  },
  {
    name: "smorimoto",
    href: "https://github.com/smorimoto",
    image: "https://github.com/smorimoto.png?size=160",
    imageAlt: "smorimoto's GitHub avatar",
    amount: "$100",
    kind: "individual",
  },
  {
    name: "Ted Brine",
    href: "https://github.com/tedbrine",
    image: "https://github.com/tedbrine.png?size=160",
    imageAlt: "Ted Brine's GitHub avatar",
    amount: "$20",
    kind: "individual",
  },
  {
    name: "Leo",
    href: "https://github.com/leoisadev1",
    image: "https://github.com/leoisadev1.png?size=160",
    imageAlt: "Leo's GitHub avatar",
    amount: "$20",
    kind: "individual",
  },
  {
    name: "Lasse",
    href: "https://github.com/lassejlv",
    image: "https://github.com/lassejlv.png?size=160",
    imageAlt: "Lasse's GitHub avatar",
    amount: "$10",
    kind: "individual",
  },
  {
    name: "Coobyk",
    href: "https://github.com/Coobyk",
    image: "https://github.com/Coobyk.png?size=160",
    imageAlt: "Coobyk's GitHub avatar",
    amount: "$5",
    kind: "individual",
    hideInSingleColumn: true,
  },
];
