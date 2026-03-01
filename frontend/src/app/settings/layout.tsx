import SubNav from "@/components/SubNav";

const tabs = [
  { href: "/settings/stores", label: "Tiendas" },
  { href: "/settings/team", label: "Equipo" },
  { href: "/settings/account", label: "Cuenta" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SubNav tabs={tabs} />
      <div className="pt-10">{children}</div>
    </>
  );
}
