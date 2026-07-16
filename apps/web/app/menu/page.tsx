import { redirect } from "next/navigation";

type MenuPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MenuPage({ searchParams }: MenuPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
      return;
    }

    if (value) {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  redirect(queryString ? `/mobile?${queryString}` : "/mobile");
}
